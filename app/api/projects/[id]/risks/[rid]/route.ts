import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getRiskById, updateProjectRisk, deleteProjectRisk, createProjectActivity } from '@/lib/projects'
import { RiskType, RiskSeverity, RiskStatus } from '@/types'

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

export async function PUT(req: NextRequest, { params }: { params: { id: string; rid: string } }) {
  const projectId = parseInt(params.id,  10)
  const riskId    = parseInt(params.rid, 10)

  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const owns = await getRiskById(riskId, projectId)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const VALID_TYPES:      RiskType[]     = ['risk', 'issue']
  const VALID_SEVERITIES: RiskSeverity[] = ['low', 'medium', 'high', 'critical']
  const VALID_STATUSES:   RiskStatus[]   = ['open', 'in_progress', 'resolved', 'closed']

  const updated = await updateProjectRisk(riskId, {
    type:        VALID_TYPES.includes(body.type)           ? body.type        : undefined,
    title:       body.title       !== undefined ? String(body.title).trim()       : undefined,
    description: body.description !== undefined ? String(body.description).trim() : undefined,
    owner:       body.owner       !== undefined ? String(body.owner).trim()       : undefined,
    severity:    VALID_SEVERITIES.includes(body.severity)  ? body.severity    : undefined,
    status:      VALID_STATUSES.includes(body.status)      ? body.status      : undefined,
    mitigation:  body.mitigation  !== undefined ? String(body.mitigation).trim()  : undefined,
    target_date: body.target_date !== undefined ? String(body.target_date).trim() : undefined,
  })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (VALID_STATUSES.includes(body.status) && owns.status !== updated.status) {
    createProjectActivity({
      project_id:  projectId,
      actor:       user.name,
      action_type: owns.type === 'issue' ? 'issue.status_changed' : 'risk.status_changed',
      entity_type: 'risk',
      entity_id:   riskId,
      description: `${user.name} changed ${updated.type} "${updated.title}" status from "${owns.status}" to "${updated.status}"`,
      metadata: { from: owns.status, to: updated.status },
    }).catch(console.error)
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; rid: string } }) {
  const projectId = parseInt(params.id,  10)
  const riskId    = parseInt(params.rid, 10)

  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const owns = await getRiskById(riskId, projectId)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await deleteProjectRisk(riskId)
  createProjectActivity({
    project_id:  projectId,
    actor:       user.name,
    action_type: owns.type === 'issue' ? 'issue.deleted' : 'risk.deleted',
    entity_type: 'risk',
    entity_id:   riskId,
    description: `${user.name} deleted ${owns.type} "${owns.title}"`,
  }).catch(console.error)
  return NextResponse.json({ ok: true })
}
