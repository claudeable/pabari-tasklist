import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { createTrackerMilestone } from '@/lib/tracker'

export const dynamic = 'force-dynamic'

async function adminOnly() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') return { user: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, err: null }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await adminOnly()
  if (err) return err
  const b = await req.json()
  if (!b.title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  const ms = await createTrackerMilestone({
    project_id: Number(params.id), title: b.title.trim(),
    start_date: b.start_date || '', end_date: b.end_date || '',
    status: b.status || 'pending', color: b.color || '#2563eb',
  })
  return NextResponse.json(ms, { status: 201 })
}
