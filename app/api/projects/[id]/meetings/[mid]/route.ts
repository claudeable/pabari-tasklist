import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { updateProjectMeeting, deleteProjectMeeting, getProjectMember, getMeetingById, createProjectActivity } from '@/lib/projects'

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

export async function PUT(req: NextRequest, { params }: { params: { id: string; mid: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const mid     = parseInt(params.mid, 10)
  const body    = await req.json()
  const updated = await updateProjectMeeting(mid, {
    title:         body.title,
    meeting_date:  body.meeting_date,
    attendees:     body.attendees,
    agenda:        body.agenda,
    notes:         body.notes,
    action_points: body.action_points,
  })
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; mid: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const mid     = parseInt(params.mid, 10)
  const meeting = await getMeetingById(mid, projectId)
  const ok      = await deleteProjectMeeting(mid)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (meeting) {
    createProjectActivity({
      project_id:  projectId,
      actor:       user.name,
      action_type: 'meeting.deleted',
      entity_type: 'meeting',
      entity_id:   mid,
      description: `${user.name} deleted meeting "${meeting.title}"`,
    }).catch(console.error)
  }
  return NextResponse.json({ ok: true })
}
