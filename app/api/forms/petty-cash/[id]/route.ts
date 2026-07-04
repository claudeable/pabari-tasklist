import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { approveHOS, approveHOD, approveFinance, rejectPettyCash, getAllPettyCashRequests } from '@/lib/pettyCash'

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'
const FINANCE_EMAIL = 'ateferi@kwale-group.com'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id     = Number(params.id)
  const { action, notes } = await req.json()
  const uid    = Number(user.id)
  const isAdmin = user.role === 'admin'

  // Find the specific request to validate hod_id
  const all = await getAllPettyCashRequests()
  const pcr = all.find(r => r.id === id)
  if (!pcr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (action === 'hos_approve') {
    if (!isAdmin && user.email !== HOS_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveHOS(id, uid)
  } else if (action === 'hod_approve') {
    const isHOD = pcr.hod_id === uid
    if (!isAdmin && !isHOD) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveHOD(id, uid)
  } else if (action === 'finance_approve') {
    if (!isAdmin && user.email !== FINANCE_EMAIL) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveFinance(id, uid)
  } else if (action === 'reject') {
    const canReject = isAdmin || user.email === HOS_EMAIL || user.email === FINANCE_EMAIL || pcr.hod_id === uid
    if (!canReject) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await rejectPettyCash(id, notes || 'Rejected')
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
