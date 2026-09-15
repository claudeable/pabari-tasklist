import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getTrackerProjects, createTrackerProject } from '@/lib/tracker'

export const dynamic = 'force-dynamic'

async function adminOnly() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') return { user: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, err: null }
}

export async function GET() {
  const { err } = await adminOnly()
  if (err) return err
  return NextResponse.json(await getTrackerProjects())
}

export async function POST(req: NextRequest) {
  const { user, err } = await adminOnly()
  if (err || !user) return err
  const b = await req.json()
  if (!b.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })
  const project = await createTrackerProject({
    name: b.name.trim(), description: b.description || '',
    company: b.company || '', owner: b.owner || user.name,
    status: b.status || 'active', rag_status: b.rag_status || 'not-set',
    start_date: b.start_date || '', end_date: b.end_date || '',
    created_by: user.name,
  })
  return NextResponse.json(project, { status: 201 })
}
