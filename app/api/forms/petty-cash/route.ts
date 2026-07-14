import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getAllPettyCashRequests, getMyPettyCashRequests, createPettyCashRequest } from '@/lib/pettyCash'
import { query } from '@/lib/database'
import { logActivity } from '@/lib/activityLog'
import { notifyByEmail } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

function safeInt(v: unknown): number | null {
  const n = parseInt(String(v ?? ''), 10)
  return isNaN(n) ? null : n
}

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'   // General HOS (Krishna)
const FINANCE_EMAIL = 'ateferi@kwale-group.com' // General Finance (Andu)
const SURESH_EMAIL  = 'ssuresh@kwale-group.com' // KISCOL HOS
const AHMAD_EMAIL   = 'ahmad@usm.co.ke'         // KISCOL final approver
const SABINA_EMAIL  = 'smutua@kwale-group.com'  // Deputy HOD for Paul (Operations)

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canSeeAll = user.role === 'admin' || user.role === 'director'
    || user.email === HOS_EMAIL || user.email === FINANCE_EMAIL
    || user.email === SURESH_EMAIL || user.email === AHMAD_EMAIL
    || user.email === SABINA_EMAIL

  const requests = canSeeAll
    ? await getAllPettyCashRequests()
    : await getMyPettyCashRequests(safeInt(user.id) ?? 0)

  return NextResponse.json({ requests })
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { form_type, payment_method, request_date, company, employee_id_no, items, total_amount, amount_in_words, delegate_name, delegate_id_no, project_id } = body

  if (!company || !request_date || !items?.length || !total_amount) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 })
  }

  // KISCOL form: only KISCOL-access users
  if (form_type === 'kiscol') {
    const hasKiscol = user.companies.includes('ALL') || user.companies.includes('KISCOL')
    if (!hasKiscol) return NextResponse.json({ error: 'Not authorized for KISCOL form.' }, { status: 403 })
  }

  // For KISCOL: Ahmad is always the final approver (hod slot)
  // For general: HOD comes from user's reports_to
  let hod_id: number | null = null
  let hod_name = ''
  if (form_type === 'kiscol') {
    const rows = await query<Record<string, unknown>>(
      'SELECT id, name FROM users WHERE LOWER(email) = LOWER($1)',
      [AHMAD_EMAIL]
    )
    if (rows.length > 0) { hod_id = safeInt(rows[0].id); hod_name = String(rows[0].name) }
  } else if (user.reports_to) {
    const rows = await query<Record<string, unknown>>(
      'SELECT id, name FROM users WHERE LOWER(email) = LOWER($1)',
      [user.reports_to]
    )
    if (rows.length > 0) { hod_id = safeInt(rows[0].id); hod_name = String(rows[0].name) }
  }

  const yearRaw = new Date(request_date).getFullYear()
  const year    = isNaN(yearRaw) ? new Date().getFullYear() : yearRaw
  const empId   = safeInt(user.id) ?? 0

  console.log('[PCR] user.id=%s empId=%d hod_id=%s year=%d', user.id, empId, hod_id, year)

  try {
    const pcr = await createPettyCashRequest({
      form_type:       form_type || 'general',
      payment_method:  payment_method || 'cash',
      request_date,
      company,
      employee_id:     empId,
      employee_name:   user.name || '',
      employee_id_no:  employee_id_no || '',
      department:      user.department || '',
      items,
      total_amount:    Number(total_amount),
      amount_in_words: amount_in_words || '',
      delegate_name:   delegate_name || '',
      delegate_id_no:  delegate_id_no || '',
      hod_id,
      hod_name,
      year,
      project_id: project_id ? Number(project_id) : null,
    })
    logActivity(user.email, user.name, 'petty_cash_submitted',
      `${user.name} submitted petty cash request — KES ${pcr.total_amount ?? ''} [${pcr.company}]`).catch(() => {})

    // WhatsApp: notify first approver (HOS for general, Suresh for KISCOL)
    const approverEmail = form_type === 'kiscol' ? SURESH_EMAIL : HOS_EMAIL
    notifyByEmail(approverEmail,
      `Pabari ERP: ${user.name} submitted a petty cash request for KES ${Number(total_amount).toLocaleString()} [${company}]. Please log in to approve.`
    ).catch(() => {})

    return NextResponse.json({ pcr })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[petty-cash POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
