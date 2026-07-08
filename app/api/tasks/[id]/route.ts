import { NextRequest, NextResponse } from 'next/server'
import { updateTask, deleteTask, createTask } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { RECURRENCE_OPTIONS, Task } from '@/types'
import { getUserByName } from '@/lib/users'
import { postDMMessage } from '@/lib/chat'
import { getSubscriptionsForUser, sendPush } from '@/lib/push'
import { logActivity } from '@/lib/activityLog'

function advanceDate(fromISO: string, days: number): string {
  const d = fromISO ? new Date(fromISO) : new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function todayDDMonYY(): string {
  const d = new Date()
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()}-${m[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}

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

  // Auto-create next recurrence when task is resolved
  if (body.status === 'resolved' && task.recurrence && task.recurrence !== 'none') {
    const opt = RECURRENCE_OPTIONS.find(o => o.value === task.recurrence)
    if (opt && opt.days > 0) {
      const nextDue = advanceDate(task.due_date || new Date().toISOString().slice(0,10), opt.days)
      await createTask({
        sno:             0,
        date:            todayDDMonYY(),
        company:         task.company,
        section:         task.section,
        category:        task.category,
        particulars:     task.particulars,
        updates:         '',
        responsible:     task.responsible,
        payment:         task.payment,
        status:          'pending-discussion',
        priority:        task.priority,
        approval_type:   task.approval_type,
        approval_status: '',
        approved_by:     '',
        approved_at:     '',
        status_wk:       '',
        hk_comment:      '',
        hod_comment:     '',
        due_date:        nextDue,
        recurrence:      task.recurrence,
        parent_id:       task.id,
      })
    }
  }

  // When HK saves a comment on an active task, DM the responsible person
  if (user && body.hk_comment?.trim() && task.status !== 'resolved' && task.status !== 'expired') {
    notifyResponsible(user, task, body.hk_comment.trim()).catch(err =>
      console.error('[task PATCH] notifyResponsible failed:', err)
    )
  }

  // Activity log: status changes and comments
  if (user) {
    const desc = task.particulars.slice(0, 70)
    if (body.status) {
      logActivity(user.email, user.name, 'task_status_changed',
        `[${task.company}] "${desc}" → ${body.status}`).catch(() => {})
    } else if (body.hk_comment) {
      logActivity(user.email, user.name, 'task_commented',
        `[${task.company}] "${desc}"`).catch(() => {})
    }
  }

  return NextResponse.json({ ok: true })
}

async function notifyResponsible(
  sender: { id: string | number; name: string },
  task: Task,
  comment: string
) {
  const responsible = await getUserByName(task.responsible)
  if (!responsible || String(responsible.id) === String(sender.id)) return

  const snippet = task.particulars.length > 70
    ? task.particulars.slice(0, 70) + '…'
    : task.particulars
  const dmText = `📋 HK commented on your task:\n"${snippet}"\n\n${comment}\n\n→ Task is still pending your update.`

  await postDMMessage(String(sender.id), sender.name, String(responsible.id), responsible.name, dmText)

  const subs = await getSubscriptionsForUser(String(responsible.id))
  if (subs.length) {
    await sendPush(subs, {
      title: `Harshil commented on your task`,
      body:  snippet,
      tag:   `hk-comment-${task.id}`,
      url:   '/',
    })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const canDelete = user.role === 'admin' || (user.role === 'director' && user.department === 'Director')
  if (!canDelete) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ok = await deleteTask(params.id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
