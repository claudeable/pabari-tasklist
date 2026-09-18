import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMeetings, createProjectMeeting, getProjectMember, createProjectActivity } from '@/lib/projects'

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
  const meetings = await getProjectMeetings(id)
  return NextResponse.json(meetings)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(id)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body    = await req.json()
  const meeting = await createProjectMeeting({
    project_id:    id,
    title:         String(body.title || ''),
    meeting_date:  String(body.meeting_date || ''),
    attendees:     String(body.attendees || ''),
    agenda:        String(body.agenda || ''),
    notes:         String(body.notes || ''),
    action_points: String(body.action_points || ''),
    logged_by:     user.name,
  })
  createProjectActivity({
    project_id:  id,
    actor:       user.name,
    action_type: 'meeting.created',
    entity_type: 'meeting',
    entity_id:   meeting.id,
    description: `${user.name} logged meeting "${meeting.title}"`,
    metadata:    { meeting_date: meeting.meeting_date },
  }).catch(console.error)

  return NextResponse.json(meeting, { status: 201 })
}
