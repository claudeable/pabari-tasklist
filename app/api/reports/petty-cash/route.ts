import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

// Krishna (HOS) and Andu/Andergachew (Finance) can see all requests
const FULL_ACCESS = ['krishna', 'krishina', 'andu', 'andergachew']

function canSeeAll(name: string, role: string) {
  if (role === 'admin') return true
  return FULL_ACCESS.includes(name.toLowerCase().split(' ')[0])
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const user        = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp        = req.nextUrl.searchParams
  const dateFrom  = sp.get('date_from') || ''
  const dateTo    = sp.get('date_to')   || ''
  const person    = sp.get('person')    || ''
  const status    = sp.get('status')    || ''
  const company   = sp.get('company')   || ''

  const allAccess = canSeeAll(user.name, user.role)

  const conds: string[] = []
  const vals:  unknown[] = []

  // Non-privileged users can only see their own
  if (!allAccess) {
    conds.push(`LOWER(employee_name) = LOWER($${vals.length+1})`)
    vals.push(user.name)
  } else if (person) {
    conds.push(`LOWER(employee_name) = LOWER($${vals.length+1})`)
    vals.push(person)
  }

  if (dateFrom) {
    conds.push(`request_date >= $${vals.length+1}`)
    vals.push(dateFrom)
  }
  if (dateTo) {
    conds.push(`request_date <= $${vals.length+1}`)
    vals.push(dateTo)
  }
  if (status) {
    conds.push(`status = $${vals.length+1}`)
    vals.push(status)
  }
  if (company) {
    conds.push(`company = $${vals.length+1}`)
    vals.push(company)
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string, unknown>>(
    `SELECT id, req_no, request_date, employee_name, company, department,
            items, total_amount, payment_method, status,
            hod_name, rejection_reason, submitted_at, project_id
     FROM petty_cash_requests ${where}
     ORDER BY request_date DESC, submitted_at DESC`,
    vals
  )

  return NextResponse.json({ rows, canSeeAll: allAccess })
}
