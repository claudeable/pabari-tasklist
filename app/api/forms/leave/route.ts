import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import {
  getAllLeaveRequests, getMyLeaveRequests, getLeaveBalance,
  createLeaveRequest, ANNUAL_LEAVE_LIMIT,
} from '@/lib/leave'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const year = new Date().getFullYear()
  const [requests, usedDays] = await Promise.all([
    (user.role === 'admin' || user.role === 'director' || user.department === 'HR')
      ? getAllLeaveRequests()
      : getMyLeaveRequests(Number(user.id)),
    getLeaveBalance(Number(user.id), year),
  ])

  return NextResponse.json({
    requests,
    usedDays,
    remaining: Math.max(0, ANNUAL_LEAVE_LIMIT - usedDays),
  })
}

export async function POST(req: NextRequest) {
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

  const year = new Date(date_from).getFullYear()

  if (leave_type === 'annual') {
    const used = await getLeaveBalance(Number(user.id), year)
    if (used + Number(days_requested) > ANNUAL_LEAVE_LIMIT) {
      const remaining = Math.max(0, ANNUAL_LEAVE_LIMIT - used)
      return NextResponse.json({
        error: `Insufficient annual leave balance. You have ${remaining} day(s) remaining for ${year}.`,
      }, { status: 400 })
    }
  }

  const leave = await createLeaveRequest({
    employee_id:      Number(user.id),
    employee_name:    user.name,
    employee_no:      employee_no || '',
    department:       user.department,
    job_title:        job_title || '',
    date_of_employment: date_of_employment || '',
    telephone:        telephone || '',
    company,
    leave_type,
    date_from,
    date_to,
    days_requested:   Number(days_requested),
    reason:           reason || '',
    cover_person:     cover_person || '',
    year,
  })

  return NextResponse.json({ leave })
}
