import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { approveHOS, approveHOD, approveHODFinal, approveFinance, rejectPettyCash, disbursePettyCash, confirmPettyCashReceipt, deletePettyCashRequest, getAllPettyCashRequests } from '@/lib/pettyCash'
import { logActivity } from '@/lib/activityLog'

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

  } else if (action === 'hod_approve') {
    if (isKiscol) {
      if (!isAdmin && user.email !== AHMAD_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await approveHODFinal(id, uid)
      logActivity(user.email, user.name, 'petty_cash_approved', `Final approval for ${pcrDesc}`).catch(() => {})
    } else {
      const nameMatch   = !!pcr.hod_name && !!user.name &&
        pcr.hod_name.split(' ')[0].toLowerCase() === user.name.split(' ')[0].toLowerCase()
      const isPaulHOD   = !!pcr.hod_name && pcr.hod_name.split(' ')[0].toLowerCase() === 'paul'
      const isDeputyHOD = user.email === SABINA_EMAIL && isPaulHOD
      const isHOD       = pcr.hod_id === uid || nameMatch || isDeputyHOD
      if (!isAdmin && !isHOD) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await approveHOD(id, uid)
      logActivity(user.email, user.name, 'petty_cash_hod_approved', `HOD approved ${pcrDesc}`).catch(() => {})
    }

  } else if (action === 'finance_approve') {
    if (isKiscol) return NextResponse.json({ error: 'Not applicable for KISCOL form.' }, { status: 400 })
    if (!isAdmin && user.email !== FINANCE_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveFinance(id, uid)
    logActivity(user.email, user.name, 'petty_cash_finance_approved', `Finance approved ${pcrDesc}`).catch(() => {})

  } else if (action === 'disburse') {
    // Only Yalelet or admin can disburse
    if (!isAdmin && user.email !== YALELET_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (pcr.status !== 'approved') return NextResponse.json({ error: 'Request must be fully approved before disbursement' }, { status: 400 })
    if (!disbursement_method) return NextResponse.json({ error: 'disbursement_method is required' }, { status: 400 })
    await disbursePettyCash(id, user.name, disbursement_method as 'cash' | 'mpesa' | 'bank_transfer', disbursement_reference ?? '')
    logActivity(user.email, user.name, 'petty_cash_disbursed', `Disbursed ${pcrDesc} via ${disbursement_method}${disbursement_reference ? ` (ref: ${disbursement_reference})` : ''}`).catch(() => {})

  } else if (action === 'confirm_receipt') {
    // Only the requester (or admin) can confirm they received the funds
    const isRequester = pcr.employee_id === uid ||
      (pcr.employee_name || '').toLowerCase() === (user.name || '').toLowerCase()
    if (!isAdmin && !isRequester) return NextResponse.json({ error: 'Only the requester can confirm receipt' }, { status: 403 })
    if (pcr.status !== 'disbursed') return NextResponse.json({ error: 'Funds must be marked as disbursed first' }, { status: 400 })
    await confirmPettyCashReceipt(id, user.name)
    logActivity(user.email, user.name, 'petty_cash_received', `${user.name} confirmed receipt of ${pcrDesc}`).catch(() => {})

  } else if (action === 'reject') {
    const hosEmail  = isKiscol ? SURESH_EMAIL : HOS_EMAIL
    const isPaulHOD   = !!pcr.hod_name && pcr.hod_name.split(' ')[0].toLowerCase() === 'paul'
    const canReject = isAdmin || user.email === hosEmail || user.email === FINANCE_EMAIL
      || user.email === AHMAD_EMAIL || pcr.hod_id === uid
      || (user.email === SABINA_EMAIL && isPaulHOD)
    if (!canReject) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await rejectPettyCash(id, notes || 'Rejected')
    logActivity(user.email, user.name, 'petty_cash_rejected', `Rejected ${pcrDesc}${notes ? ` — ${notes}` : ''}`).catch(() => {})

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
