import { NextRequest, NextResponse } from 'next/server'
import { createTask, addUpdate, getTasks } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { logActivity } from '@/lib/activityLog'
import { getUserByEmail } from '@/lib/users'
import { postDMMessage } from '@/lib/chat'

export const dynamic = 'force-dynamic'

async function notifyLegal(
  sender: { id: string | number; name: string },
  taskDesc: string,
  company: string
) {
  const msg = `⚖️ Legal task assigned — [${company}] ${taskDesc}`
  const recipients = [
    'bnzuka@usm.co.ke',        // Benson (Group CEO)
    'dkulecho@kwale-group.com', // David Kulecho (Legal)
  ]
  await Promise.all(recipients.map(async email => {
    const u = await getUserByEmail(email)
    if (u && String(u.id) !== String(sender.id)) {
      await postDMMessage(String(sender.id), sender.name, String(u.id), u.name, msg)
    }
  }))
}

export async function GET() {
  const tasks = await getTasks()
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const body  = await req.json()
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null

  // KISCOL tasks can only be created by users who have KISCOL (or ALL) company access
  if (body.company === 'KISCOL') {
    const hasKiscol = user && (user.companies.includes('ALL') || user.companies.includes('KISCOL'))
    if (!hasKiscol) {
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
    legal_review:    body.legal_review === true,
  })

  if (body.initial_update) {
    await addUpdate(task.id, {
      date: body.update_date ?? body.date,
      text: body.initial_update,
    })
  }

  if (user) {
    const desc = `Created task [${task.company}] "${task.particulars.slice(0, 80)}" → ${task.responsible}`
    logActivity(user.email, user.name, 'task_created', desc).catch(() => {})

    if (body.legal_review === true) {
      notifyLegal(user, task.particulars, task.company).catch(() => {})
    }
  }

  return NextResponse.json({ task })
}
