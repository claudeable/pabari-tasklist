import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { updateProjectUpdate, deleteProjectUpdate, addProjectUpdateComment, deleteProjectUpdateComment, getProjectMember, getProjectUpdateById, createProjectActivity } from '@/lib/projects'
import { UpdateType, UpdateStatus } from '@/types'

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

export async function PUT(req: NextRequest, { params }: { params: { id: string; uid: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const uid  = parseInt(params.uid, 10)
  const body = await req.json()

  const oldUpdate = body.status !== undefined ? await getProjectUpdateById(uid) : null

  const updated = await updateProjectUpdate(uid, {
    type:       body.type       as UpdateType   | undefined,
    status:     body.status     as UpdateStatus | undefined,
    title:      body.title,
    body:       body.body,
    owner:      body.owner,
    next_steps: body.next_steps,
  })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (body.status !== undefined && oldUpdate && oldUpdate.status !== updated.status) {
    createProjectActivity({
      project_id:  projectId,
      actor:       user.name,
      action_type: 'update.status_changed',
      entity_type: 'update',
      entity_id:   uid,
      description: `${user.name} changed update "${updated.title || updated.type}" status from "${oldUpdate.status}" to "${updated.status}"`,
      metadata: { from: oldUpdate.status, to: updated.status },
    }).catch(console.error)
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; uid: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const uid = parseInt(params.uid, 10)
  const ok = await deleteProjectUpdate(uid)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

// POST /api/projects/[id]/updates/[uid] — add a comment
export async function POST(req: NextRequest, { params }: { params: { id: string; uid: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const uid  = parseInt(params.uid, 10)
  const body = await req.json()
  const comment = await addProjectUpdateComment({
    update_id: uid,
    user_name: user.name,
    message:   String(body.message || ''),
  })
  return NextResponse.json(comment, { status: 201 })
}
