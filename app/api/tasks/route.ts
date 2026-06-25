import { NextRequest, NextResponse } from 'next/server'
import { createTask, addUpdate, getTasks } from '@/lib/db'

export async function GET() {
  return NextResponse.json(getTasks())
}

export async function POST(req: NextRequest) {
  const body = await req.json()

  const task = createTask({
    sno:         body.sno ?? 0,
    date:        body.date ?? '',
    company:     body.company ?? '',
    section:     body.section ?? 'General',
    category:    body.category ?? 'Other',
    particulars: body.particulars ?? '',
    updates:     body.initial_update ?? '',
    responsible: body.responsible ?? '',
    payment:     body.payment ?? 'Non-Payment',
    status:      body.status ?? 'pending-discussion',
    status_wk:   body.status_wk ?? '',
    hk_comment:  body.hk_comment ?? '',
  })

  if (body.initial_update) {
    addUpdate(task.id, {
      date: body.update_date ?? body.date,
      text: body.initial_update,
    })
  }

  return NextResponse.json({ task })
}
