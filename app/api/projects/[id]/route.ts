import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectById, updateProject, deleteProject, createMilestone, getProjectTasks } from '@/lib/projects'
import { ProjectStatus } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = parseInt(params.id, 10)
  const [project, tasks] = await Promise.all([getProjectById(id), getProjectTasks(id)])
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ project, tasks })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id   = parseInt(params.id, 10)
  const body = await req.json()

  // Add milestone
  if (body.add_milestone) {
    const ms = await createMilestone({ project_id: id, title: body.title, due_date: body.due_date || '' })
    return NextResponse.json(ms)
  }

  const project = await updateProject(id, {
    name:        body.name,
    description: body.description,
    company:     body.company,
    owner:       body.owner,
    status:      body.status as ProjectStatus,
    start_date:  body.start_date,
    end_date:    body.end_date,
    budget:      body.budget !== undefined ? Number(body.budget) : undefined,
    spent:       body.spent  !== undefined ? Number(body.spent)  : undefined,
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(project)
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
