import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { approveHOS, approveHOD, approveHODFinal, approveFinance, rejectPettyCash, disbursePettyCash, confirmPettyCashReceipt, deletePettyCashRequest, getAllPettyCashRequests } from '@/lib/pettyCash'
import { logActivity } from '@/lib/activityLog'
import { notifyByEmail, getPhoneByEmail, sendWhatsApp } from '@/lib/whatsapp'
import { pushToEmail } from '@/lib/webpush'

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'
const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const SURESH_EMAIL  = 'ssuresh@kwale-group.com'
const AHMAD_EMAIL   = 'ahmad@usm.co.ke'
const SABINA_EMAIL  = 'smutua@kwale-group.com'
const YALELET_EMAIL = 'yaynalem@usm.co.ke'      // Disburses cash after approval

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safeInt = (v: unknown) => { const n = parseInt(String(v ?? ''), 10); return isNaN(n) ? 0 : n }
  const id      = safeInt(params.id)
  const uid     = safeInt(user.id)
  const body = await req.json()
  const { action, notes, disbursement_method, disbursement_reference } = body
  const isAdmin = user.role === 'admin'

  const all = await getAllPettyCashRequests()
  const pcr = all.find(r => r.id === id)
  if (!pcr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isKiscol = pcr.form_type === 'kiscol'

  const pcrDesc = `${pcr.employee_name}'s petty cash KES ${pcr.total_amount ?? ''} [${pcr.company}]`

  if (action === 'hos_approve') {
    const allowed = isAdmin || (isKiscol ? user.email === SURESH_EMAIL : user.email === HOS_EMAIL)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveHOS(id, uid)
    logActivity(user.email, user.name, 'petty_cash_hos_approved', `HOS approved ${pcrDesc}`).catch(() => {})
    // Notify HOD (or Ahmad for KISCOL) that their approval is needed
    if (isKiscol) {
      notifyByEmail(AHMAD_EMAIL, `Pabari ERP: ${pcr.employee_name}'s petty cash KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] needs your final approval.`).catch(() => {})
    } else if (pcr.hod_name) {
      // Try to notify HOD by looking up their email from hod_name
      import('@/lib/users').then(async ({ getUsers }) => {
        const users = await getUsers()
        const hod = users.find(u => u.name.split(' ')[0].toLowerCase() === pcr.hod_name!.split(' ')[0].toLowerCase())
        if (hod?.email) notifyByEmail(hod.email, `Pabari ERP: ${pcr.employee_name}'s petty cash KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] needs your HOD approval.`).catch(() => {})
      }).catch(() => {})
    }

  } else if (action === 'hod_approve') {
    if (isKiscol) {
      if (!isAdmin && user.email !== AHMAD_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await approveHODFinal(id, uid)
      logActivity(user.email, user.name, 'petty_cash_approved', `Final approval for ${pcrDesc}`).catch(() => {})
      // KISCOL: notify Yalelet to disburse
      pushToEmail(YALELET_EMAIL, { title: 'Cash Disbursement Needed', body: `${pcr.employee_name} — KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] approved`, url: '/forms/petty-cash', tag: 'disburse' }).catch(() => {})
      notifyByEmail(YALELET_EMAIL, `Pabari ERP: ${pcr.employee_name}'s petty cash KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] is fully approved. Please disburse.`).catch(() => {})
    } else {
      const nameMatch   = !!pcr.hod_name && !!user.name &&
        pcr.hod_name.split(' ')[0].toLowerCase() === user.name.split(' ')[0].toLowerCase()
      const isPaulHOD   = !!pcr.hod_name && pcr.hod_name.split(' ')[0].toLowerCase() === 'paul'
      const isDeputyHOD = user.email === SABINA_EMAIL && isPaulHOD
      const isHOD       = pcr.hod_id === uid || nameMatch || isDeputyHOD
      if (!isAdmin && !isHOD) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await approveHOD(id, uid)
      logActivity(user.email, user.name, 'petty_cash_hod_approved', `HOD approved ${pcrDesc}`).catch(() => {})
      // Notify Finance for final approval
      pushToEmail(FINANCE_EMAIL, { title: 'Petty Cash — Finance Approval', body: `${pcr.employee_name} — KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}]`, url: '/forms/petty-cash', tag: 'pcr' }).catch(() => {})
      notifyByEmail(FINANCE_EMAIL, `Pabari ERP: ${pcr.employee_name}'s petty cash KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] needs finance approval.`).catch(() => {})
    }

  } else if (action === 'finance_approve') {
    if (isKiscol) return NextResponse.json({ error: 'Not applicable for KISCOL form.' }, { status: 400 })
    if (!isAdmin && user.email !== FINANCE_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveFinance(id, uid)
    logActivity(user.email, user.name, 'petty_cash_finance_approved', `Finance approved ${pcrDesc}`).catch(() => {})
    // Notify Yalelet to disburse
    pushToEmail(YALELET_EMAIL, { title: 'Cash Disbursement Needed', body: `${pcr.employee_name} — KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] approved`, url: '/forms/petty-cash', tag: 'disburse' }).catch(() => {})
    notifyByEmail(YALELET_EMAIL, `Pabari ERP: ${pcr.employee_name}'s petty cash KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] is fully approved. Please disburse.`).catch(() => {})

  } else if (action === 'disburse') {
    // Only Yalelet or admin can disburse
    if (!isAdmin && user.email !== YALELET_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (pcr.status !== 'approved') return NextResponse.json({ error: 'Request must be fully approved before disbursement' }, { status: 400 })
    if (!disbursement_method) return NextResponse.json({ error: 'disbursement_method is required' }, { status: 400 })
    await disbursePettyCash(id, user.name, disbursement_method as 'cash' | 'mpesa' | 'bank_transfer', disbursement_reference ?? '')
    logActivity(user.email, user.name, 'petty_cash_disbursed', `Disbursed ${pcrDesc} via ${disbursement_method}${disbursement_reference ? ` (ref: ${disbursement_reference})` : ''}`).catch(() => {})
    // Notify requester that funds are on the way
    try {
      const rows = await import('@/lib/database').then(m => m.query<{ email: string }>(
        `SELECT email FROM users WHERE id=$1 OR LOWER(name)=LOWER($2) LIMIT 1`,
        [pcr.employee_id, pcr.employee_name]
      ))
      if (rows[0]?.email) {
        const methodLabel = disbursement_method === 'mpesa' ? 'MPesa' : disbursement_method === 'bank_transfer' ? 'bank transfer' : 'cash'
        notifyByEmail(rows[0].email,
          `Pabari ERP: Your petty cash of KES ${Number(pcr.total_amount).toLocaleString()} has been disbursed via ${methodLabel}${disbursement_reference ? ` (ref: ${disbursement_reference})` : ''}. Please log in to confirm receipt.`
        ).catch(() => {})
      }
    } catch { /* */ }

  } else if (action === 'confirm_receipt') {
    // Only the requester (or admin) can confirm they received the funds
    const isRequester = pcr.employee_id === uid ||
      (pcr.employee_name || '').toLowerCase() === (user.name || '').toLowerCase()
    if (!isAdmin && !isRequester) return NextResponse.json({ error: 'Only the requester can confirm receipt' }, { status: 403 })
    if (pcr.status !== 'disbursed') return NextResponse.json({ error: 'Funds must be marked as disbursed first' }, { status: 400 })
    await confirmPettyCashReceipt(id, user.name)
    logActivity(user.email, user.name, 'petty_cash_received', `${user.name} confirmed receipt of ${pcrDesc}`).catch(() => {})
    // Notify Yalelet that receipt was confirmed
    notifyByEmail(YALELET_EMAIL, `Pabari ERP: ${pcr.employee_name} confirmed receipt of KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}].`).catch(() => {})

  } else if (action === 'reject') {
    const hosEmail  = isKiscol ? SURESH_EMAIL : HOS_EMAIL
    const isPaulHOD   = !!pcr.hod_name && pcr.hod_name.split(' ')[0].toLowerCase() === 'paul'
    const canReject = isAdmin || user.email === hosEmail || user.email === FINANCE_EMAIL
      || user.email === AHMAD_EMAIL || pcr.hod_id === uid
      || (user.email === SABINA_EMAIL && isPaulHOD)
    if (!canReject) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await rejectPettyCash(id, notes || 'Rejected')
    logActivity(user.email, user.name, 'petty_cash_rejected', `Rejected ${pcrDesc}${notes ? ` — ${notes}` : ''}`).catch(() => {})
    // Notify requester of rejection
    try {
      const rows = await import('@/lib/database').then(m => m.query<{ email: string }>(
        `SELECT email FROM users WHERE id=$1 OR LOWER(name)=LOWER($2) LIMIT 1`,
        [pcr.employee_id, pcr.employee_name]
      ))
      if (rows[0]?.email) {
        notifyByEmail(rows[0].email,
          `Pabari ERP: Your petty cash request for KES ${Number(pcr.total_amount).toLocaleString()} [${pcr.company}] was rejected${notes ? `: ${notes}` : '.'}`
        ).catch(() => {})
      }
    } catch { /* */ }

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const ok = await deletePettyCashRequest(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
