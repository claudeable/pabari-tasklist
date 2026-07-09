import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import {
  getAllLeaveRequests, getMyLeaveRequests, getLeaveBalance,
  createLeaveRequest, ANNUAL_LEAVE_LIMIT,
} from '@/lib/leave'
import { logActivity } from '@/lib/activityLog'
import { rateLimit } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

function safeInt(v: unknown): number {
  const n = parseInt(String(v ?? ''), 10)
  return isNaN(n) ? 0 : n
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = new Date().getFullYear()
  const [requests, usedDays] = await Promise.all([
    (user.role === 'admin' || user.role === 'director' || user.department === 'HR')
      ? getAllLeaveRequests()
      : getMyLeaveRequests(user.name, Number(user.id)),
    getLeaveBalance(user.name, year),
  ])

  return NextResponse.json({
    requests,
    usedDays,
    remaining: Math.max(0, ANNUAL_LEAVE_LIMIT - usedDays),
  })
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (rateLimit(ip, 10, 60 * 60 * 1000))
    return NextResponse.json({ error: 'Too many requests. Please wait before submitting again.' }, { status: 429 })

  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    employee_no, job_title, date_of_employment, telephone,
    company, leave_type, date_from, date_to, days_requested,
    reason, cover_person,
  } = body

  if (!company || !leave_type || !date_from || !date_to || !days_requested) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const yearRaw = new Date(date_from).getFullYear()
  const year    = isNaN(yearRaw) ? new Date().getFullYear() : yearRaw

  console.log('[LEAVE] user.id=%s safeInt=%d year=%d days=%s', user.id, safeInt(user.id), year, days_requested)

  if (leave_type === 'annual') {
    const used = await getLeaveBalance(user.name, year)
    if (used + Number(days_requested) > ANNUAL_LEAVE_LIMIT) {
      const remaining = Math.max(0, ANNUAL_LEAVE_LIMIT - used)
      return NextResponse.json({
        error: `Insufficient annual leave balance. You have ${remaining} day(s) remaining for ${year}.`,
      }, { status: 400 })
    }
  }

  try {
    const leave = await createLeaveRequest({
      employee_id:        safeInt(user.id),
      employee_name:      user.name || '',
      employee_no:        employee_no || '',
      department:         user.department || '',
      job_title:          job_title || '',
      date_of_employment: date_of_employment || '',
      telephone:          telephone || '',
      company,
      leave_type,
      date_from,
      date_to,
      days_requested:     safeInt(days_requested),
      reason:             reason || '',
      cover_person:       cover_person || '',
      year,
    })
    logActivity(user.email, user.name, 'leave_submitted',
      `${user.name} submitted ${leave_type} leave request: ${date_from} – ${date_to} (${days_requested} day${Number(days_requested) !== 1 ? 's' : ''})`).catch(() => {})
    return NextResponse.json({ leave })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[leave POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
