import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { approveByHR, approveByHK, rejectLeave, deleteLeaveRequest } from '@/lib/leave'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safeInt = (v: unknown) => { const n = parseInt(String(v ?? ''), 10); return isNaN(n) ? 0 : n }
  const id  = safeInt(params.id)
  const uid = safeInt(user.id)
  const { action, notes } = await req.json()

  const isHR    = user.department === 'HR' || user.role === 'admin'
  const isAdmin = user.role === 'admin'

  if (action === 'hr_approve') {
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveByHR(id, uid, notes || '')
  } else if (action === 'hk_approve') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveByHK(id, uid, notes || '')
  } else if (action === 'reject') {
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await rejectLeave(id, notes || 'Rejected')
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
  const ok = await deleteLeaveRequest(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
