import { NextRequest, NextResponse } from 'next/server'
import { updateTask, deleteTask, createTask } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { RECURRENCE_OPTIONS } from '@/types'

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
      })
    }
  }

  return NextResponse.json({ ok: true })
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
