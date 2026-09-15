import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { updateTrackerMeeting, deleteTrackerMeeting } from '@/lib/tracker'

export const dynamic = 'force-dynamic'

async function adminOnly() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') return { user: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, err: null }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await adminOnly()
  if (err) return err
  const b = await req.json()
  const m = await updateTrackerMeeting(Number(params.id), b)
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(m)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await adminOnly()
  if (err) return err
  await deleteTrackerMeeting(Number(params.id))
  return NextResponse.json({ ok: true })
}
