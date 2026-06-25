import { NextRequest, NextResponse } from 'next/server'
import { updateTask, deleteTask } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const task = updateTask(params.id, body)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const ok = deleteTask(params.id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
