import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getTrackerUpdates, createTrackerUpdate } from '@/lib/tracker'

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
  return NextResponse.json(await getTrackerUpdates(Number(params.id)))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, err } = await adminOnly()
  if (err || !user) return err
  const b = await req.json()
  if (!b.body?.trim()) return NextResponse.json({ error: 'Update text required' }, { status: 400 })
  const update = await createTrackerUpdate({
    project_id: Number(params.id), posted_by: user.name,
    update_type: b.update_type || 'progress', body: b.body.trim(),
    next_steps: b.next_steps || '', owner: b.owner || '',
    update_date: b.update_date || new Date().toISOString().slice(0, 10),
  })
  return NextResponse.json(update, { status: 201 })
}
