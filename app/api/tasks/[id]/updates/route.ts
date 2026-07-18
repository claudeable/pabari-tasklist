import { NextRequest, NextResponse } from 'next/server'
import { addUpdate, editUpdate } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { logActivity } from '@/lib/activityLog'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body  = await req.json()
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null

  const update = await addUpdate(params.id, { date: body.date, text: body.text })
  if (!update) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  if (user) {
    const snippet = (body.text as string).slice(0, 80)
    logActivity(user.email, user.name, 'task_update_posted', `"${snippet}"`).catch(() => {})
  }

  return NextResponse.json({ update })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || !['admin', 'director'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body   = await req.json()
  const update = await editUpdate(body.updateId, { text: body.text, date: body.date })
  if (!update) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  logActivity(user.email, user.name, 'task_update_edited', `update ${body.updateId}`).catch(() => {})
  return NextResponse.json({ update })
}
