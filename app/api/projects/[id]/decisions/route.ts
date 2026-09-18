import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getProjectDecisions, createProjectDecision, createProjectActivity } from '@/lib/projects'
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

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  const decisions = await getProjectDecisions(projectId)
  return NextResponse.json(decisions)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const body = await req.json()
  const title: string = String(body.title || '').trim()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })

  const VALID_STATUSES: DecisionStatus[] = ['pending', 'decided', 'deferred', 'rejected']
  const status: DecisionStatus = VALID_STATUSES.includes(body.status) ? body.status : 'pending'

  const decision = await createProjectDecision({
    project_id:    projectId,
    title,
    description:   String(body.description || '').trim(),
    status,
    owner:         String(body.owner || '').trim(),
    decision_date: String(body.decision_date || '').trim(),
    source:        String(body.source || '').trim(),
    created_by:    user.name,
  })
  createProjectActivity({
    project_id:  projectId,
    actor:       user.name,
    action_type: 'decision.created',
    entity_type: 'decision',
    entity_id:   decision.id,
    description: `${user.name} logged decision: "${decision.title}"`,
    metadata:    { status: decision.status },
  }).catch(console.error)
  return NextResponse.json(decision, { status: 201 })
}
