import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount } from '@/lib/mail/zoho'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// POST /api/mail/emails/[id]/create-task — convert email into an ERP task
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(parseInt(user.id))
  if (!account) return NextResponse.json({ error: 'No mail account' }, { status: 404 })

  const email = await query<{
    id: number; subject: string; from_name: string; from_email: string
    snippet: string; received_at: string
    priority: string; category: string; deadline: string; summary: string; recommended_action: string
  }>(
    `SELECT e.id, e.subject, e.from_name, e.from_email, e.snippet, e.received_at,
            a.priority, a.category, a.deadline, a.summary, a.recommended_action
     FROM mail_emails e
     LEFT JOIN mail_email_analysis a ON a.email_id = e.id
     WHERE e.id = $1 AND e.account_id = $2`,
    [params.id, account.id]
  )
  if (!email[0]) return NextResponse.json({ error: 'Email not found' }, { status: 404 })

  const e = email[0]
  const body = await req.json().catch(() => ({}))

  // Allow caller to override fields; defaults are AI-derived
  const particulars = body.particulars
    ?? `${e.summary || e.subject} [from ${e.from_name || e.from_email}]`
  const responsible = body.responsible ?? user.name
  const company     = body.company     ?? 'General'
  const section     = body.section     ?? 'General'
  const category    = body.category    ?? (e.category ?? 'Correspondence')
  const dueDate     = body.due_date    ?? (
    e.deadline === 'Today'    ? new Date().toISOString().slice(0, 10)
    : e.deadline === 'Tomorrow' ? new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    : e.deadline !== 'None'   ? e.deadline
    : ''
  )
  const priority = body.priority ?? (
    e.priority === 'Critical' ? 'high'
    : e.priority === 'High'   ? 'high'
    : e.priority === 'Medium' ? 'medium'
    : 'low'
  )

  const updates = `Email from ${e.from_name || e.from_email} · ${new Date(e.received_at).toLocaleDateString('en-GB')} · "${e.snippet?.slice(0, 200) ?? ''}"`

  const taskRows = await query<{ id: number }>(
    `INSERT INTO tasks
       (date, company, section, category, particulars, updates, responsible,
        payment, status, priority, due_date, created_by)
     VALUES
       ($1, $2, $3, $4, $5, $6, $7,
        'Non-Payment', 'action-required', $8, $9, $10)
     RETURNING id`,
    [
      new Date().toISOString().slice(0, 10),
      company, section, category,
      particulars.slice(0, 500),
      updates,
      responsible,
      priority,
      dueDate,
      user.name,
    ]
  )

  const taskId = taskRows[0]?.id
  if (!taskId) return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })

  // Link email → task
  await execute(
    `INSERT INTO mail_email_tasks (email_id, task_id, created_by)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [e.id, taskId, parseInt(user.id)]
  )

  return NextResponse.json({ ok: true, task_id: taskId })
}
