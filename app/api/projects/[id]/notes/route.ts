import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getProjectNotes, createProjectNote, deleteProjectNote } from '@/lib/projects'

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

  const notes = await getProjectNotes(projectId)
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const note = await createProjectNote({
    project_id: projectId,
    user_name:  user.name,
    message:    message.trim(),
  })
  return NextResponse.json(note)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const { note_id } = await req.json()
  if (!note_id) return NextResponse.json({ error: 'note_id required' }, { status: 400 })
  await deleteProjectNote(Number(note_id))
  return NextResponse.json({ ok: true })
}
