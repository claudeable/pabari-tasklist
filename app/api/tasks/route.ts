import { NextRequest, NextResponse } from 'next/server'
import { createTask, addUpdate, getTasks } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { logActivity } from '@/lib/activityLog'
import { getUserByEmail, getUserByName } from '@/lib/users'
import { postDMMessage } from '@/lib/chat'
import { FINANCE_VISIBLE_EMAILS } from '@/types'
import { sendEmail } from '@/lib/email'

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

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  let tasks = await getTasks()
  // Finance tasks restricted to whitelist — but always show tasks the user is responsible for
  if (!user || !FINANCE_VISIBLE_EMAILS.has((user.email || '').toLowerCase())) {
    const userName  = (user?.name || '').toLowerCase()
    const firstName = userName.split(' ')[0]
    const userEmail = (user?.email || '').toLowerCase()
    tasks = tasks.filter(t => {
      if (t.category !== 'Finance') return true
      const resp = t.responsible.toLowerCase()
      return resp === userName || resp === firstName || resp.startsWith(firstName) || resp === userEmail
    })
  }
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  const body  = await req.json()
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null

  const task = await createTask({
    sno:             body.sno ?? 0,
    date:            body.date ?? '',
    company:         body.company ?? '',
    section:         body.section ?? 'General',
    category:        body.category ?? 'Other',
    particulars:     body.particulars ?? '',
    updates:         '',
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
    co_assignees:    [],
    project_id:      body.project_id ? Number(body.project_id) : undefined,
    created_by:      user?.name ?? '',
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

    const taskUrl = `https://pabari-workspace.up.railway.app/tasks?id=${task.id}`
    const viewBtn = `<a href="${taskUrl}" style="display:inline-block;background:#1a3a2a;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:600;margin-top:8px">View Task →</a>`

    // Email HK when a high-priority task is created
    if (task.priority === 'high') {
      getUserByName('Harshil').then(hk => {
        if (hk?.email && hk.email.toLowerCase() !== user.email.toLowerCase()) {
          sendEmail({
            to: hk.email,
            subject: `High Priority Task Created: ${task.particulars.slice(0, 60)}`,
            body: `Hi Harshil,\n\nA high-priority task has been created that may need your comment.\n\n<strong>${task.particulars}</strong>\nCompany: ${task.company}\nSection: ${task.section}\nResponsible: ${task.responsible}\nCreated by: ${user.name}\n\n${viewBtn}`,
          }).catch(() => {})
        }
      }).catch(() => {})
    }

    // Email the assigned person (skip if they created it themselves)
    if (task.responsible) {
      getUserByName(task.responsible).then(assignee => {
        if (assignee?.email && assignee.email.toLowerCase() !== user.email.toLowerCase()) {
          sendEmail({
            to: assignee.email,
            subject: `Task Assigned: ${task.particulars.slice(0, 60)}`,
            body: `Hi ${assignee.name.split(' ')[0]},\n\nA new task has been assigned to you by ${user.name}.\n\n<strong>${task.particulars}</strong>\nCompany: ${task.company}\nSection: ${task.section}\n\n${viewBtn}`,
          }).catch(() => {})
        }
      }).catch(() => {})
    }
  }

  return NextResponse.json({ task })
}
