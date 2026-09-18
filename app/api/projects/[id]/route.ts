import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectById, updateProject, deleteProject, createMilestone, getProjectTasks, getProjectMember, createProjectActivity } from '@/lib/projects'
import { ProjectStatus } from '@/types'

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

  const [project, tasks] = await Promise.all([getProjectById(id), getProjectTasks(id)])
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ project, tasks })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(id)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  if (body.add_milestone) {
    const ms = await createMilestone({ project_id: id, title: body.title, due_date: body.due_date || '', start_date: body.start_date || '', color: body.color || '#2563eb', amount: Number(body.amount) || 0 })
    createProjectActivity({
      project_id:  id,
      actor:       user.name,
      action_type: 'milestone.created',
      entity_type: 'milestone',
      entity_id:   ms.id,
      description: `${user.name} added milestone "${ms.title}"`,
    }).catch(console.error)
    return NextResponse.json(ms)
  }

  const patch: Parameters<typeof updateProject>[1] = {}
  if (body.name        !== undefined) patch.name        = body.name
  if (body.description !== undefined) patch.description = body.description
  if (body.company     !== undefined) patch.company     = body.company
  if (body.category    !== undefined) patch.category    = body.category
  if (body.owner       !== undefined) patch.owner       = body.owner
  if (body.status      !== undefined) patch.status      = body.status as ProjectStatus
  if (body.rag_status  !== undefined) patch.rag_status  = body.rag_status
  if (body.start_date  !== undefined) patch.start_date  = body.start_date
  if (body.end_date    !== undefined) patch.end_date    = body.end_date
  if (body.budget      !== undefined) patch.budget      = Number(body.budget)
  if (body.spent       !== undefined) patch.spent       = Number(body.spent)

  const needsOldState = body.status !== undefined || body.rag_status !== undefined
  const [oldProject, updatedProject] = await Promise.all([
    needsOldState ? getProjectById(id) : Promise.resolve(null),
    updateProject(id, patch),
  ])
  if (!updatedProject) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (needsOldState && oldProject) {
    if (body.status !== undefined && oldProject.status !== updatedProject.status) {
      createProjectActivity({
        project_id:  id,
        actor:       user.name,
        action_type: 'project.status_changed',
        entity_type: 'project',
        entity_id:   id,
        description: `${user.name} changed project status from "${oldProject.status}" to "${updatedProject.status}"`,
        metadata: { from: oldProject.status, to: updatedProject.status },
      }).catch(console.error)
    }
    if (body.rag_status !== undefined && oldProject.rag_status !== updatedProject.rag_status) {
      createProjectActivity({
        project_id:  id,
        actor:       user.name,
        action_type: 'project.rag_changed',
        entity_type: 'project',
        entity_id:   id,
        description: `${user.name} changed RAG status from "${oldProject.rag_status}" to "${updatedProject.rag_status}"`,
        metadata: { from: oldProject.rag_status, to: updatedProject.rag_status },
      }).catch(console.error)
    }
  }

  return NextResponse.json(updatedProject)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || (user.role !== 'admin' && user.role !== 'director')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = parseInt(params.id, 10)
  const ok = await deleteProject(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
