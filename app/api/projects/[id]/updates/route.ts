import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectUpdates, createProjectUpdate, getProjectMember, createProjectActivity } from '@/lib/projects'
import { UpdateType } from '@/types'

export const dynamic = 'force-dynamic'

async function getAuthedUser(projectId: number) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') {
    const member = await getProjectMember(projectId, user.name)
    if (!member) return { user: null, err: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { user, err: null }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(id)
  if (!user) return err!
  const updates = await getProjectUpdates(id)
  return NextResponse.json(updates)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(id)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const update = await createProjectUpdate({
    project_id: id,
    type:        (body.type as UpdateType) || 'general',
    title:       String(body.title || ''),
    body:        String(body.body || ''),
    owner:       String(body.owner || ''),
    next_steps:  String(body.next_steps || ''),
    posted_by:   user.name,
  })
  createProjectActivity({
    project_id:  id,
    actor:       user.name,
    action_type: 'update.posted',
    entity_type: 'update',
    entity_id:   update.id,
    description: `${user.name} posted update: "${update.title || update.type}"`,
    metadata:    { type: update.type },
  }).catch(console.error)
  return NextResponse.json(update, { status: 201 })
}
