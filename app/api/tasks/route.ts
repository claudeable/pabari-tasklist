import { NextRequest, NextResponse } from 'next/server'
import { createTask, addUpdate, getTasks } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tasks = await getTasks()
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  // KISCOL tasks can only be created by director, ceo, or admin
  if (body.company === 'KISCOL') {
    const token = req.cookies.get('pabari-session')?.value
    const user  = token ? await verifyToken(token) : null
    if (!user || !['director', 'ceo', 'admin'].includes(user.role)) {
      return NextResponse.json({ error: 'Not authorised to create KISCOL tasks.' }, { status: 403 })
    }
  }

  const task = await createTask({
    sno:             body.sno ?? 0,
    date:            body.date ?? '',
    company:         body.company ?? '',
    section:         body.section ?? 'General',
    category:        body.category ?? 'Other',
    particulars:     body.particulars ?? '',
    updates:         body.initial_update ?? '',
    responsible:     body.responsible ?? '',
    payment:         body.payment ?? 'Non-Payment',
    status:          body.status   ?? 'pending-discussion',
    priority:        body.priority ?? 'medium',
    approval_type:   body.approval_type ?? '',
    approval_status: '',
    approved_by:     '',
    approved_at:     '',
    status_wk:       body.status_wk ?? '',
    hk_comment:      body.hk_comment ?? '',
    hod_comment:     body.hod_comment ?? '',
    due_date:        body.due_date ?? '',
    recurrence:      body.recurrence ?? 'none',
    parent_id:       body.parent_id ? String(body.parent_id) : undefined,
  })

  if (body.initial_update) {
    await addUpdate(task.id, {
      date: body.update_date ?? body.date,
      text: body.initial_update,
    })
  }

  return NextResponse.json({ task })
}
