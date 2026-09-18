import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMilestoneById, getProjectMember, updateMilestone, deleteMilestone, createProjectActivity } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id      = parseInt(params.id, 10)
  const existing = await getMilestoneById(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'admin') {
    const member = await getProjectMember(existing.project_id, user.name)
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await req.json()
  const ms   = await updateMilestone(id, { status: body.status, title: body.title, due_date: body.due_date, start_date: body.start_date, color: body.color, amount: body.amount !== undefined ? Number(body.amount) : undefined })
  if (!ms) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (body.status !== undefined) {
    createProjectActivity({
      project_id:  ms.project_id,
      actor:       user.name,
      action_type: 'milestone.status_changed',
      entity_type: 'milestone',
      entity_id:   ms.id,
      description: `${user.name} marked milestone "${ms.title}" as ${ms.status}`,
      metadata: { status: ms.status },
    }).catch(console.error)
  }
  return NextResponse.json(ms)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || (user.role !== 'admin' && user.role !== 'director')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const id = parseInt(params.id, 10)
  const existing = await getMilestoneById(id)
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (user.role !== 'admin') {
    const member = await getProjectMember(existing.project_id, user.name)
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const ok = await deleteMilestone(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
