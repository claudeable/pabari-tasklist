import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { approveHOS, approveHOD, approveHODFinal, approveFinance, rejectPettyCash, getAllPettyCashRequests } from '@/lib/pettyCash'

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'   // General HOS
const FINANCE_EMAIL = 'ateferi@kwale-group.com' // General Finance
const SURESH_EMAIL  = 'ssuresh@kwale-group.com' // KISCOL step 1
const AHMAD_EMAIL   = 'ahmad@usm.co.ke'         // KISCOL step 2 (final)

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safeInt = (v: unknown) => { const n = parseInt(String(v ?? ''), 10); return isNaN(n) ? 0 : n }
  const id      = safeInt(params.id)
  const uid     = safeInt(user.id)
  const { action, notes } = await req.json()
  const isAdmin = user.role === 'admin'

  const all = await getAllPettyCashRequests()
  const pcr = all.find(r => r.id === id)
  if (!pcr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isKiscol = pcr.form_type === 'kiscol'

  if (action === 'hos_approve') {
    const allowed = isAdmin || (isKiscol ? user.email === SURESH_EMAIL : user.email === HOS_EMAIL)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveHOS(id, uid)

  } else if (action === 'hod_approve') {
    if (isKiscol) {
      // Ahmad is final approver for KISCOL — goes directly to 'approved'
      if (!isAdmin && user.email !== AHMAD_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await approveHODFinal(id, uid)
    } else {
      const nameMatch = !!pcr.hod_name && !!user.name &&
        pcr.hod_name.split(' ')[0].toLowerCase() === user.name.split(' ')[0].toLowerCase()
      const isHOD = pcr.hod_id === uid || nameMatch
      if (!isAdmin && !isHOD) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      await approveHOD(id, uid)
    }

  } else if (action === 'finance_approve') {
    if (isKiscol) return NextResponse.json({ error: 'Not applicable for KISCOL form.' }, { status: 400 })
    if (!isAdmin && user.email !== FINANCE_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveFinance(id, uid)

  } else if (action === 'reject') {
    const hosEmail  = isKiscol ? SURESH_EMAIL : HOS_EMAIL
    const canReject = isAdmin || user.email === hosEmail || user.email === FINANCE_EMAIL
      || user.email === AHMAD_EMAIL || pcr.hod_id === uid
    if (!canReject) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await rejectPettyCash(id, notes || 'Rejected')

  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
