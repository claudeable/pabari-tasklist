import { NextRequest, NextResponse } from 'next/server'
import { updateTask, deleteTask } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  const changedBy = user?.name ?? 'Unknown'

  const body = await req.json()
  const task = await updateTask(params.id, body, changedBy)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = await deleteTask(params.id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
