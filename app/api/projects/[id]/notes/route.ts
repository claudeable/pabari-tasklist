import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectNotes, createProjectNote, deleteProjectNote } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notes = await getProjectNotes(parseInt(params.id, 10))
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Message required' }, { status: 400 })

  const note = await createProjectNote({
    project_id: parseInt(params.id, 10),
    user_name:  user.name,
    message:    message.trim(),
  })
  return NextResponse.json(note)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { note_id } = await req.json()
  if (!note_id) return NextResponse.json({ error: 'note_id required' }, { status: 400 })
  await deleteProjectNote(Number(note_id))
  return NextResponse.json({ ok: true })
}
