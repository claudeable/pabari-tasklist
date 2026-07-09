import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserByEmail } from '@/lib/users'
import { signToken } from '@/lib/auth'
import { postSystemMessage } from '@/lib/chat'
import { logActivity } from '@/lib/activityLog'
import { resolveLocation } from '@/lib/geoip'
import { isIPBlocked, blockIP, logSecurityEvent, analyzeThreat } from '@/lib/security'

export const dynamic = 'force-dynamic'

// IP-based rate limit (fast in-memory guard)
const ipAttempts = new Map<string, { count: number; resetAt: number }>()
// Account-based lockout (per email)
const accountLockouts = new Map<string, { count: number; lockedUntil: number }>()

const IP_LIMIT    = 5
const IP_WINDOW   = 15 * 60 * 1000   // 15 min
const ACCT_LIMIT  = 8
const ACCT_LOCK   = 30 * 60 * 1000   // 30 min lockout

function checkIPRateLimit(ip: string): boolean {
  const now = Date.now()
  const rec = ipAttempts.get(ip)
  if (!rec || now > rec.resetAt) {
    ipAttempts.set(ip, { count: 1, resetAt: now + IP_WINDOW })
    return false
  }
  if (rec.count >= IP_LIMIT) return true
  rec.count++
  return false
}

function checkAccountLockout(email: string): { locked: boolean; minutesLeft?: number } {
  const now = Date.now()
  const rec = accountLockouts.get(email.toLowerCase())
  if (!rec) return { locked: false }
  if (now > rec.lockedUntil) { accountLockouts.delete(email.toLowerCase()); return { locked: false } }
  if (rec.count >= ACCT_LIMIT) {
    return { locked: true, minutesLeft: Math.ceil((rec.lockedUntil - now) / 60000) }
  }
  return { locked: false }
}

function recordAccountFailure(email: string) {
  const now  = Date.now()
  const key  = email.toLowerCase()
  const rec  = accountLockouts.get(key)
  const count = (rec?.count || 0) + 1
  accountLockouts.set(key, {
    count,
    lockedUntil: count >= ACCT_LIMIT ? now + ACCT_LOCK : (rec?.lockedUntil || 0),
  })
}

function clearAccountFailures(email: string) {
  accountLockouts.delete(email.toLowerCase())
  ipAttempts.delete(email)
}

function validatePassword(password: string): string | null {
  if (password.length < 8)             return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password))        return 'Password must contain at least one uppercase letter.'
  if (!/[0-9]/.test(password))        return 'Password must contain at least one number.'
  return null
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  // 1. Check if IP is permanently blocked in DB
  const { blocked: ipBlocked } = await isIPBlocked(ip)
  if (ipBlocked) {
    await logSecurityEvent('blocked_ip_attempt', ip, '', 'Login attempt from blocked IP', 100)
    return NextResponse.json({ error: 'Access denied.' }, { status: 403 })
  }

  // 2. In-memory IP rate limit
  if (checkIPRateLimit(ip)) {
    await logSecurityEvent('ip_rate_limited', ip, '', 'IP rate limit exceeded', 60)
    return NextResponse.json(
      { error: 'Too many login attempts. Please wait 15 minutes.' },
      { status: 429 }
    )
  }

  const body = await req.json()
  const email    = (body.email    || '').trim().toLowerCase()
  const password = body.password  || ''

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  // 3. Per-account lockout
  const lockout = checkAccountLockout(email)
  if (lockout.locked) {
    await logSecurityEvent('account_locked', ip, email, `Account locked — ${lockout.minutesLeft} min remaining`, 50)
    return NextResponse.json(
      { error: `Account temporarily locked. Try again in ${lockout.minutesLeft} minute(s).` },
      { status: 429 }
    )
  }

  const user = await getUserByEmail(email)

  if (!user) {
    // Don't reveal whether email exists
    recordAccountFailure(email)
    await logSecurityEvent('login_failed', ip, email, 'Unknown email', 10)
    const score = await analyzeThreat(ip, email)
    if (score >= 80) {
      await blockIP(ip, `Auto-blocked: score ${score} (brute force)`, 'system', 24)
      await logSecurityEvent('ip_auto_blocked', ip, email, `Auto-blocked score=${score}`, score, true)
    }
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    recordAccountFailure(email)
    await logSecurityEvent('login_failed', ip, email, 'Wrong password', 15)
    const score = await analyzeThreat(ip, email)
    if (score >= 80) {
      await blockIP(ip, `Auto-blocked: score ${score} (brute force)`, 'system', 24)
      await logSecurityEvent('ip_auto_blocked', ip, email, `Auto-blocked score=${score}`, score, true)
    }
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  // Successful login
  clearAccountFailures(email)
  await logSecurityEvent('login_success', ip, email, 'Successful login', 0)

  const token = await signToken({
    id:         user.id,
    name:       user.name,
    email:      user.email,
    role:       user.role,
    department: user.department,
    reports_to: user.reports_to,
    companies:  user.companies,
  })

  postSystemMessage(`🟢 ${user.name} logged in`).catch(() => {})
  resolveLocation(ip)
    .then(loc => logActivity(user.email, user.name, 'login', `Logged in from ${loc}`))
    .catch(() => logActivity(user.email, user.name, 'login', `Logged in from ${ip}`).catch(() => {}))

  const res = NextResponse.json({ ok: true, name: user.name, role: user.role })
  res.cookies.set('pabari-session', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24,
  })
  return res
}
