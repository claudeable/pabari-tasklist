import { NextRequest, NextResponse } from 'next/server'
import { createTask, addUpdate, getTasks } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tasks = await getTasks()
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const task = await createTask({
    sno:         body.sno ?? 0,
    date:        body.date ?? '',
    company:     body.company ?? '',
    section:     body.section ?? 'General',
    category:    body.category ?? 'Other',
    particulars: body.particulars ?? '',
    updates:     body.initial_update ?? '',
    responsible: body.responsible ?? '',
    payment:     body.payment ?? 'Non-Payment',
    status:      body.status   ?? 'pending-discussion',
    priority:    body.priority ?? 'medium',
    status_wk:   body.status_wk ?? '',
    hk_comment:  body.hk_comment ?? '',
  })

  if (body.initial_update) {
    await addUpdate(task.id, {
      date: body.update_date ?? body.date,
      text: body.initial_update,
    })
  }

  return NextResponse.json({ task })
}
