import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getDecisionById, updateProjectDecision, deleteProjectDecision, createProjectActivity } from '@/lib/projects'
import { DecisionStatus } from '@/types'

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

export async function PUT(req: NextRequest, { params }: { params: { id: string; did: string } }) {
  const projectId   = parseInt(params.id,  10)
  const decisionId  = parseInt(params.did, 10)

  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const owns = await getDecisionById(decisionId, projectId)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const VALID_STATUSES: DecisionStatus[] = ['pending', 'decided', 'deferred', 'rejected']

  const updated = await updateProjectDecision(decisionId, {
    title:         body.title         !== undefined ? String(body.title).trim()         : undefined,
    description:   body.description   !== undefined ? String(body.description).trim()   : undefined,
    status:        VALID_STATUSES.includes(body.status) ? body.status                   : undefined,
    owner:         body.owner         !== undefined ? String(body.owner).trim()         : undefined,
    decision_date: body.decision_date !== undefined ? String(body.decision_date).trim() : undefined,
    source:        body.source        !== undefined ? String(body.source).trim()        : undefined,
  })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (VALID_STATUSES.includes(body.status) && owns.status !== updated.status) {
    createProjectActivity({
      project_id:  projectId,
      actor:       user.name,
      action_type: 'decision.status_changed',
      entity_type: 'decision',
      entity_id:   decisionId,
      description: `${user.name} changed decision "${updated.title}" status from "${owns.status}" to "${updated.status}"`,
      metadata: { from: owns.status, to: updated.status },
    }).catch(console.error)
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; did: string } }) {
  const projectId  = parseInt(params.id,  10)
  const decisionId = parseInt(params.did, 10)

  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const owns = await getDecisionById(decisionId, projectId)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteProjectDecision(decisionId)
  createProjectActivity({
    project_id:  projectId,
    actor:       user.name,
    action_type: 'decision.deleted',
    entity_type: 'decision',
    entity_id:   decisionId,
    description: `${user.name} deleted decision "${owns.title}"`,
  }).catch(console.error)
  return NextResponse.json({ ok: true })
}
