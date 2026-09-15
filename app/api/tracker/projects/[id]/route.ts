import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getTrackerProject, updateTrackerProject, deleteTrackerProject } from '@/lib/tracker'

export const dynamic = 'force-dynamic'

async function adminOnly() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') return { user: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, err: null }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await adminOnly()
  if (err) return err
  const project = await getTrackerProject(Number(params.id))
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await adminOnly()
  if (err) return err
  const b = await req.json()
  const project = await updateTrackerProject(Number(params.id), b)
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await adminOnly()
  if (err) return err
  await deleteTrackerProject(Number(params.id))
  return NextResponse.json({ ok: true })
}
