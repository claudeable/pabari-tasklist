import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getTrackerMeetings, createTrackerMeeting } from '@/lib/tracker'

export const dynamic = 'force-dynamic'

async function adminOnly() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') return { user: null, err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user, err: null }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const { err } = await adminOnly()
  if (err) return err
  return NextResponse.json(await getTrackerMeetings(Number(params.id)))
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { user, err } = await adminOnly()
  if (err || !user) return err
  const b = await req.json()
  if (!b.title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 })
  const meeting = await createTrackerMeeting({
    project_id: Number(params.id), title: b.title.trim(),
    meeting_date: b.meeting_date || new Date().toISOString().slice(0, 10),
    attendees: b.attendees || '', agenda: b.agenda || '',
    notes: b.notes || '', action_points: b.action_points || '',
    created_by: user.name,
  })
  return NextResponse.json(meeting, { status: 201 })
}
