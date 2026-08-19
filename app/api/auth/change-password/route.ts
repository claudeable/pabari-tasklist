import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { verifyToken, signToken } from '@/lib/auth'
import { getUserByEmail, updateUserPassword, clearMustChangePassword } from '@/lib/users'

function validatePassword(password: string): string | null {
  if (password.length < 8)                  return 'Password must be at least 8 characters.'
  if (!/[A-Z]/.test(password))              return 'Password must contain at least one uppercase letter.'
  if (!/[0-9]/.test(password))              return 'Password must contain at least one number.'
  if (!/[^A-Za-z0-9]/.test(password))      return 'Password must contain at least one special character.'
  return null
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both fields are required.' }, { status: 400 })
  }

  const strengthError = validatePassword(newPassword)
  if (strengthError) return NextResponse.json({ error: strengthError }, { status: 400 })

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'New password must be different from the current one.' }, { status: 400 })
  }

  const user = await getUserByEmail(session.email)
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })

  const newHash = await bcrypt.hash(newPassword, 10)
  const ok = await updateUserPassword(user.id, newHash)
  if (!ok) return NextResponse.json({ error: 'Failed to save new password.' }, { status: 500 })

  // Clear the forced-change flag
  await clearMustChangePassword(user.id)

  // Re-issue the session cookie without must_change_password
  const newToken = await signToken({
    id:                  session.id,
    name:                session.name,
    email:               session.email,
    role:                session.role,
    department:          session.department,
    reports_to:          session.reports_to,
    hod_email:           session.hod_email,
    companies:           session.companies,
    portals:             session.portals,
    must_change_password: false,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('pabari-session', newToken, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24 * 30,
  })
  return res
}
