import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getProjectRisks, createProjectRisk, createProjectActivity } from '@/lib/projects'
import { RiskType, RiskSeverity } from '@/types'

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
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  const risks = await getProjectRisks(projectId)
  return NextResponse.json(risks)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const body = await req.json()
  const title: string = String(body.title || '').trim()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const VALID_TYPES:      RiskType[]     = ['risk', 'issue']
  const VALID_SEVERITIES: RiskSeverity[] = ['low', 'medium', 'high', 'critical']

  const type:     RiskType     = VALID_TYPES.includes(body.type)           ? body.type     : 'risk'
  const severity: RiskSeverity = VALID_SEVERITIES.includes(body.severity)  ? body.severity : 'medium'

  const risk = await createProjectRisk({
    project_id:  projectId,
    type,
    title,
    description: String(body.description || '').trim(),
    owner:       String(body.owner || '').trim(),
    severity,
    mitigation:  String(body.mitigation || '').trim(),
    target_date: String(body.target_date || '').trim(),
    created_by:  user.name,
  })
  createProjectActivity({
    project_id:  projectId,
    actor:       user.name,
    action_type: risk.type === 'issue' ? 'issue.created' : 'risk.created',
    entity_type: 'risk',
    entity_id:   risk.id,
    description: `${user.name} logged ${risk.type} "${risk.title}" (${risk.severity})`,
    metadata:    { type: risk.type, severity: risk.severity },
  }).catch(console.error)

  return NextResponse.json(risk, { status: 201 })
}
