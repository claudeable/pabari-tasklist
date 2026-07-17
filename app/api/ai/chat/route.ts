import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import Groq from 'groq-sdk'

async function buildEmailContext(userId: string): Promise<string> {
  try {
    const account = await query<{ id: number; account_email: string }>(
      `SELECT id, account_email FROM mail_accounts WHERE user_id = $1 AND provider = 'zoho' AND sync_status = 'active' LIMIT 1`,
      [userId]
    )
    if (!account[0]) return ''

    const aid = account[0].id
    const [stats, criticals, actionable] = await Promise.all([
      query<{ total: string; critical: string; high: string; unread: string; req_action: string }>(
        `SELECT COUNT(e.id)::text AS total,
                COUNT(CASE WHEN a.priority='Critical' THEN 1 END)::text AS critical,
                COUNT(CASE WHEN a.priority='High' THEN 1 END)::text AS high,
                COUNT(CASE WHEN e.is_read=false THEN 1 END)::text AS unread,
                COUNT(CASE WHEN a.requires_action=true AND e.is_read=false THEN 1 END)::text AS req_action
         FROM mail_emails e
         LEFT JOIN mail_email_analysis a ON a.email_id = e.id
         WHERE e.account_id = $1 AND e.is_archived=false AND e.received_at >= now() - interval '24 hours'`,
        [aid]
      ),
      query<{ subject: string; from_name: string; from_email: string; summary: string; deadline: string; received_at: string }>(
        `SELECT e.subject, e.from_name, e.from_email, a.summary, a.deadline,
                e.received_at::text
         FROM mail_emails e
         JOIN mail_email_analysis a ON a.email_id = e.id
         WHERE e.account_id = $1 AND a.priority='Critical' AND e.is_read=false AND e.is_archived=false
         ORDER BY e.received_at DESC LIMIT 5`,
        [aid]
      ),
      query<{ subject: string; from_name: string; summary: string; deadline: string; priority: string }>(
        `SELECT e.subject, e.from_name, a.summary, a.deadline, a.priority
         FROM mail_emails e
         JOIN mail_email_analysis a ON a.email_id = e.id
         WHERE e.account_id = $1 AND a.requires_action=true AND e.is_read=false AND e.is_archived=false
           AND e.received_at >= now() - interval '48 hours'
         ORDER BY CASE a.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 ELSE 3 END
         LIMIT 10`,
        [aid]
      ),
    ])

    const s = stats[0]
    if (!s || parseInt(s.total) === 0) return ''

    const lines: string[] = [
      `## Email Intelligence (${account[0].account_email} · last 24h)`,
      `- Received: ${s.total} emails | Critical: ${s.critical} | High: ${s.high} | Unread: ${s.unread} | Need action: ${s.req_action}`,
    ]

    if (criticals.length > 0) {
      lines.push(`Critical emails awaiting response:`)
      criticals.forEach(e => {
        const from = e.from_name || e.from_email
        const dl   = e.deadline && e.deadline !== 'None' ? ` | deadline: ${e.deadline}` : ''
        lines.push(`- "${e.subject}" from ${from}${dl} — ${e.summary}`)
      })
    }

    if (actionable.length > 0) {
      lines.push(`Emails requiring action:`)
      actionable.forEach(e => {
        const dl = e.deadline && e.deadline !== 'None' ? ` [${e.deadline}]` : ''
        lines.push(`- [${e.priority}] "${e.subject}" from ${e.from_name}${dl} — ${e.summary}`)
      })
    }

    lines.push('')
    return lines.join('\n')
  } catch {
    return ''
  }
}

export const dynamic = 'force-dynamic'

const EXEC_NAMES = ['harshil', 'benson']

const today = () => new Date().toISOString().slice(0, 10)

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

function isExecutive(user: { role: string; name: string }) {
  const first = (user.name?.split(' ')[0] ?? '').toLowerCase()
  return user.role === 'admin' || EXEC_NAMES.includes(first)
}

// ── Context for Harshil (HK) — operational, approval-focused ─────────────
async function buildHKContext(userName: string, userId: string) {
  const now = today()
  const lines: string[] = [
    `## Executive Profile`,
    `Name: ${userName}`,
    `Role: Group Director / HK (Harshil Kumar)`,
    `Today: ${now} | ${getGreeting()}`,
    `Active modules: Tasks, Forms (PCR + Leave), Delivery Notes`,
    '',
  ]

  // Task counts
  try {
    const counts = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM tasks
       WHERE status NOT IN ('resolved','expired')
       GROUP BY status ORDER BY count::int DESC`
    )
    const total = counts.reduce((s, r) => s + parseInt(r.count, 10), 0)
    lines.push(`## Task Overview (${total} total open)`)
    counts.forEach(r => lines.push(`- ${r.status}: ${r.count}`))
    lines.push('')
  } catch { /**/ }

  // HK comment queue
  try {
    const needComment = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks
       WHERE status NOT IN ('resolved','expired')
         AND (hk_comment IS NULL OR TRIM(hk_comment) = '')`
    )
    const cnt = parseInt(needComment[0]?.count ?? '0', 10)
    if (cnt > 0) {
      lines.push(`## Your HK Comment Queue: ${cnt} tasks awaiting your direction`)
      const sample = await query<{ particulars: string; company: string; responsible: string; status: string; priority: string }>(
        `SELECT particulars, company, responsible, status, priority FROM tasks
         WHERE status NOT IN ('resolved','expired')
           AND (hk_comment IS NULL OR TRIM(hk_comment) = '')
         ORDER BY CASE status WHEN 'action-required' THEN 0 WHEN 'in-review' THEN 1 ELSE 2 END,
                  CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
         LIMIT 15`
      )
      sample.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | owner: ${t.responsible} | ${t.status} | ${t.priority}`))
      lines.push('')
    }
  } catch { /**/ }

  // Action-required
  try {
    const actionTasks = await query<{ particulars: string; company: string; responsible: string; due_date: string; priority: string }>(
      `SELECT particulars, company, responsible, COALESCE(due_date::text,'') AS due_date, priority
       FROM tasks WHERE status = 'action-required'
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, due_date ASC NULLS LAST
       LIMIT 20`
    )
    if (actionTasks.length > 0) {
      lines.push(`## Action Required (${actionTasks.length}) — need immediate decision:`)
      actionTasks.forEach(t => {
        const due = t.due_date ? ` | due: ${t.due_date}` : ''
        lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible} | ${t.priority}${due}`)
      })
      lines.push('')
    }
  } catch { /**/ }

  // Awaiting HK approval
  try {
    const approvals = await query<{ particulars: string; company: string; responsible: string }>(
      `SELECT particulars, company, responsible FROM tasks WHERE status = 'awaiting-hk-approval' LIMIT 15`
    )
    if (approvals.length > 0) {
      lines.push(`## Awaiting Your Approval (${approvals.length}):`)
      approvals.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible}`))
      lines.push('')
    }
  } catch { /**/ }

  // Overdue
  try {
    const overdue = await query<{ particulars: string; company: string; responsible: string; due_date: string; priority: string }>(
      `SELECT particulars, company, responsible, due_date::text, priority
       FROM tasks WHERE status NOT IN ('resolved','expired') AND due_date IS NOT NULL AND due_date < $1::date
       ORDER BY due_date ASC LIMIT 10`, [now]
    )
    if (overdue.length > 0) {
      lines.push(`## Overdue Tasks (${overdue.length} past due date):`)
      overdue.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible} | due: ${t.due_date} | ${t.priority}`))
      lines.push('')
    }
  } catch { /**/ }

  // Petty cash
  try {
    const pcrs = await query<{ req_no: string; employee_name: string; company: string; total_amount: string; status: string }>(
      `SELECT req_no, employee_name, company, total_amount::text, status
       FROM petty_cash_requests WHERE status NOT IN ('received','rejected')
       ORDER BY total_amount::numeric DESC LIMIT 20`
    )
    if (pcrs.length > 0) {
      lines.push(`## Petty Cash Requests (${pcrs.length} active):`)
      pcrs.forEach(r => {
        const amt = Number(r.total_amount)
        const flag = amt >= 500000 ? ' *** HIGH VALUE ***' : amt >= 100000 ? ' [HIGH VALUE]' : ''
        lines.push(`- ${r.req_no} | ${r.employee_name} | KES ${amt.toLocaleString()} [${r.company}] | ${r.status}${flag}`)
      })
    } else {
      lines.push(`## Petty Cash: No active requests.`)
    }
    lines.push('')
  } catch { /**/ }

  // Leave
  try {
    const leaves = await query<{ employee_name: string; leave_type: string; date_from: string; date_to: string; days_requested: number; status: string; company: string }>(
      `SELECT employee_name, leave_type, date_from::text, date_to::text, days_requested, status, company
       FROM leave_requests WHERE status NOT IN ('approved','rejected')
       ORDER BY created_at DESC LIMIT 15`
    )
    if (leaves.length > 0) {
      lines.push(`## Leave Requests (${leaves.length} pending):`)
      leaves.forEach(l => lines.push(`- ${l.employee_name} | ${l.leave_type} | ${l.date_from} → ${l.date_to} (${l.days_requested}d) | ${l.company} | ${l.status}`))
    } else {
      lines.push(`## Leave: No pending requests.`)
    }
    lines.push('')
  } catch { /**/ }

  // Email intelligence
  const emailCtx = await buildEmailContext(userId)
  if (emailCtx) lines.push(emailCtx)

  // Delivery notes
  try {
    const dn = await query<{ total: string; active: string; cancelled: string; this_week: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(CASE WHEN status='active' THEN 1 END)::text AS active,
              COUNT(CASE WHEN status='cancelled' THEN 1 END)::text AS cancelled,
              COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text AS this_week
       FROM delivery_notes`
    )
    lines.push(`## Delivery Notes: ${dn[0]?.active ?? 0} active | ${dn[0]?.cancelled ?? 0} cancelled | ${dn[0]?.this_week ?? 0} this week`)
    lines.push('')
  } catch { /**/ }

  // Weekly team performance
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const resolved = await query<{ responsible: string; resolved_count: string }>(
      `SELECT responsible, COUNT(*)::text AS resolved_count FROM tasks
       WHERE status='resolved' AND updated_at >= $1::date AND responsible IS NOT NULL AND responsible != ''
       GROUP BY responsible ORDER BY resolved_count::int DESC LIMIT 15`, [weekAgo]
    )
    const openPerPerson = await query<{ responsible: string; open: string; action_req: string }>(
      `SELECT responsible, COUNT(*)::text AS open,
              COUNT(CASE WHEN status='action-required' THEN 1 END)::text AS action_req
       FROM tasks WHERE status NOT IN ('resolved','expired') AND responsible IS NOT NULL AND responsible != ''
       GROUP BY responsible ORDER BY open::int DESC LIMIT 20`
    )
    lines.push(`## Weekly Team Performance`)
    if (resolved.length > 0) resolved.forEach(r => lines.push(`- ${r.responsible}: ${r.resolved_count} resolved this week`))
    else lines.push(`- No tasks resolved this week`)
    lines.push('')
    lines.push(`Open tasks per person:`)
    openPerPerson.forEach(r => {
      const ar = parseInt(r.action_req, 10)
      lines.push(`- ${r.responsible}: ${r.open} open${ar > 0 ? ` | ${ar} action-required` : ''}`)
    })
    lines.push('')
  } catch { /**/ }

  return lines.join('\n')
}

// ── Context for Benson — strategic overview, not operational ─────────────
async function buildBensonContext(userName: string, userId: string) {
  const now = today()
  const lines: string[] = [
    `## Executive Profile`,
    `Name: ${userName}`,
    `Role: Group CEO (incoming) — strategic oversight`,
    `Today: ${now} | ${getGreeting()}`,
    `Active modules: Tasks, Forms (PCR + Leave), Delivery Notes`,
    `NOTE: Task approvals and HK comments route to Harshil (HK), not to ${userName}.`,
    '',
  ]

  // Benson's own tasks
  try {
    const myTasks = await query<{ particulars: string; company: string; status: string; priority: string; days_waiting: string }>(
      `SELECT particulars, company, status, priority,
              GREATEST(0, EXTRACT(DAY FROM NOW() - created_at))::int::text AS days_waiting
       FROM tasks
       WHERE LOWER(responsible) LIKE $1
         AND status NOT IN ('resolved','expired')
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, created_at ASC
       LIMIT 20`, [`%${userName.split(' ')[0].toLowerCase()}%`]
    )
    if (myTasks.length > 0) {
      lines.push(`## Your Personal Task Queue (${myTasks.length} assigned to you):`)
      myTasks.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.status} | ${t.priority} | ${t.days_waiting}d open`))
    } else {
      lines.push(`## Your Personal Task Queue: No tasks currently assigned to you.`)
    }
    lines.push('')
  } catch { /**/ }

  // Company-wide task health (overview for CEO, not personal to-do)
  try {
    const counts = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM tasks
       WHERE status NOT IN ('resolved','expired') GROUP BY status ORDER BY count::int DESC`
    )
    const total = counts.reduce((s, r) => s + parseInt(r.count, 10), 0)
    const actionReq = counts.find(r => r.status === 'action-required')?.count ?? '0'
    const awaitingHK = counts.find(r => r.status === 'awaiting-hk-approval')?.count ?? '0'
    lines.push(`## Company Task Health (${total} open tasks across all staff):`)
    lines.push(`- Action required by staff: ${actionReq}`)
    lines.push(`- Awaiting Harshil's approval: ${awaitingHK} (routes to HK, not you)`)
    lines.push('')
  } catch { /**/ }

  // By-company breakdown — useful for CEO oversight
  try {
    const byCompany = await query<{ company: string; total: string; action_req: string }>(
      `SELECT company, COUNT(*)::text AS total,
              COUNT(CASE WHEN status='action-required' THEN 1 END)::text AS action_req
       FROM tasks WHERE status NOT IN ('resolved','expired')
       GROUP BY company ORDER BY total::int DESC LIMIT 15`
    )
    if (byCompany.length > 0) {
      lines.push(`## Task Backlog by Company:`)
      byCompany.forEach(r => {
        const ar = parseInt(r.action_req, 10)
        lines.push(`- ${r.company}: ${r.total} open${ar > 0 ? ` | ${ar} need staff action` : ''}`)
      })
      lines.push('')
    }
  } catch { /**/ }

  // Overdue tasks across the company — CEO-level risk view
  try {
    const overdue = await query<{ particulars: string; company: string; responsible: string; due_date: string; priority: string }>(
      `SELECT particulars, company, responsible, due_date::text, priority
       FROM tasks WHERE status NOT IN ('resolved','expired') AND due_date IS NOT NULL AND due_date < $1::date
       ORDER BY due_date ASC LIMIT 10`, [now]
    )
    if (overdue.length > 0) {
      lines.push(`## Company Overdue Tasks (${overdue.length} past due — for your awareness):`)
      overdue.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | staff: ${t.responsible} | due: ${t.due_date} | ${t.priority}`))
      lines.push('')
    }
  } catch { /**/ }

  // Team performance — CEO cares who is delivering
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const resolved = await query<{ responsible: string; resolved_count: string }>(
      `SELECT responsible, COUNT(*)::text AS resolved_count FROM tasks
       WHERE status='resolved' AND updated_at >= $1::date AND responsible IS NOT NULL AND responsible != ''
       GROUP BY responsible ORDER BY resolved_count::int DESC LIMIT 15`, [weekAgo]
    )
    const openPerPerson = await query<{ responsible: string; open: string }>(
      `SELECT responsible, COUNT(*)::text AS open FROM tasks
       WHERE status NOT IN ('resolved','expired') AND responsible IS NOT NULL AND responsible != ''
       GROUP BY responsible ORDER BY open::int DESC LIMIT 20`
    )
    lines.push(`## Team Productivity (this week):`)
    if (resolved.length > 0) resolved.forEach(r => lines.push(`- ${r.responsible}: ${r.resolved_count} tasks completed`))
    else lines.push(`- No completions recorded this week`)
    lines.push('')
    lines.push(`Heaviest workloads:`)
    openPerPerson.slice(0, 8).forEach(r => lines.push(`- ${r.responsible}: ${r.open} open tasks`))
    lines.push('')
  } catch { /**/ }

  // Petty cash — CEO-level: company totals, not operational detail
  try {
    const pcrs = await query<{ req_no: string; employee_name: string; company: string; total_amount: string; status: string }>(
      `SELECT req_no, employee_name, company, total_amount::text, status
       FROM petty_cash_requests WHERE status NOT IN ('received','rejected')
       ORDER BY total_amount::numeric DESC LIMIT 20`
    )
    if (pcrs.length > 0) {
      const totalAmt = pcrs.reduce((s, r) => s + Number(r.total_amount), 0)
      const highValue = pcrs.filter(r => Number(r.total_amount) >= 100000)
      lines.push(`## Petty Cash Requests (${pcrs.length} active | KES ${totalAmt.toLocaleString()} total exposure):`)
      if (highValue.length > 0) {
        lines.push(`High-value items (≥ KES 100K):`)
        highValue.forEach(r => lines.push(`- ${r.req_no} | ${r.employee_name} | KES ${Number(r.total_amount).toLocaleString()} [${r.company}] | ${r.status}`))
      }
    } else {
      lines.push(`## Petty Cash: No active requests.`)
    }
    lines.push('')
  } catch { /**/ }

  // Leave requests
  try {
    const leaves = await query<{ employee_name: string; leave_type: string; date_from: string; date_to: string; days_requested: number; company: string; status: string }>(
      `SELECT employee_name, leave_type, date_from::text, date_to::text, days_requested, company, status
       FROM leave_requests WHERE status NOT IN ('approved','rejected')
       ORDER BY created_at DESC LIMIT 15`
    )
    if (leaves.length > 0) {
      lines.push(`## Leave Requests (${leaves.length} pending approval):`)
      leaves.forEach(l => lines.push(`- ${l.employee_name} | ${l.leave_type} | ${l.date_from} → ${l.date_to} (${l.days_requested}d) | ${l.company}`))
    } else {
      lines.push(`## Leave: No pending requests.`)
    }
    lines.push('')
  } catch { /**/ }

  // Delivery notes summary
  try {
    const dn = await query<{ total: string; active: string; cancelled: string; this_week: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(CASE WHEN status='active' THEN 1 END)::text AS active,
              COUNT(CASE WHEN status='cancelled' THEN 1 END)::text AS cancelled,
              COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text AS this_week
       FROM delivery_notes`
    )
    const recent = await query<{ note_number: string; to_company: string; delivery_date: string }>(  // Benson delivery query
      `SELECT note_number, to_company, delivery_date FROM delivery_notes
       WHERE status='active' ORDER BY created_at DESC LIMIT 5`
    )
    lines.push(`## Delivery Notes: ${dn[0]?.active ?? 0} active | ${dn[0]?.cancelled ?? 0} cancelled | ${dn[0]?.this_week ?? 0} issued this week`)
    if (recent.length > 0) {
      lines.push(`Recent deliveries:`)
      recent.forEach(d => lines.push(`- DN-${d.note_number} → ${d.to_company} | ${d.delivery_date}`))
    }
    lines.push('')
  } catch { /**/ }

  // Email intelligence
  const emailCtx2 = await buildEmailContext(userId)
  if (emailCtx2) lines.push(emailCtx2)

  return lines.join('\n')
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isExecutive(user)) {
    return NextResponse.json({ error: 'Executive AI is available to directors and administrators only.' }, { status: 403 })
  }

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }
  if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'AI not configured — add GROQ_API_KEY to Railway environment variables.' }, { status: 503 })
  }

  const firstName = user.name?.split(' ')[0] ?? user.name
  const isHK = firstName.toLowerCase() === 'harshil'

  const context = isHK
    ? await buildHKContext(user.name ?? '', user.id)
    : await buildBensonContext(user.name ?? '', user.id)

  const systemPrompt = isHK
    ? `You are the Pabari Executive AI — private decision intelligence for ${user.name}, Group Director (HK) at Pabari Group.

ACTIVE MODULES: Tasks, Forms (Petty Cash + Leave), Delivery Notes.
NOT YET LIVE: Finance, Projects, Documents — say so if asked.

LIVE DATA (${today()}):
${context}

## Your Priority Order:
1. HK Comment queue — your comment unblocks team progress
2. Action Required tasks — need your immediate decision
3. Tasks awaiting your approval
4. High-value PCR (≥ KES 100K)
5. Leave requests pending

## Response rules:
- Lead with the numbers (how many, who, what company)
- Name specific tasks, people, companies from the data
- Flag high-priority and high-value items
- Give clear recommendations on what to address first
- Be direct. No filler. Use the actual data.
- Briefing structure: HK Comment Queue → Action Required → Approvals → PCR → Leave → Delivery Notes

Today is ${today()}, good ${getGreeting()}, ${firstName}.`

    : `You are the Pabari Executive AI — strategic briefing assistant for ${user.name}, incoming Group CEO at Pabari Group.

CRITICAL ROLE CONTEXT:
- ${firstName} is in a STRATEGIC OVERSIGHT role, not operational
- Task HK comments are Harshil's responsibility — NOT ${firstName}'s
- Task approvals ("awaiting-hk-approval") route to Harshil — NOT ${firstName}
- ${firstName} oversees company performance, his own assigned tasks, and strategic decisions
- NEVER tell ${firstName} he has items "needing his comment" — that is HK's function
- Frame everything as: here is what is happening in the business, here are risks to watch, here is what your team is doing

ACTIVE MODULES: Tasks, Forms (Petty Cash + Leave), Delivery Notes.
NOT YET LIVE: Finance, Projects, Documents — say so if asked.

LIVE DATA (${today()}):
${context}

## Briefing structure for ${firstName}:
1. Your personal task queue (tasks assigned to you)
2. Company health overview (what is happening across the business)
3. Key risks and overdue items (for your awareness as CEO)
4. Team productivity (who is delivering, who has heavy backlogs)
5. Forms overview (PCR spend, leave requests)
6. Delivery notes summary

## Response rules:
- NEVER say "${firstName} has X tasks needing his HK comment" — those belong to Harshil
- Frame company data as business intelligence, not personal to-do lists
- If ${firstName} asks what needs his attention, focus on HIS tasks and strategic decisions
- Highlight risks, bottlenecks, and performance issues at company level
- Be concise and executive-level — summary first, detail on request
- Use actual names, companies, and numbers from the data

Today is ${today()}, good ${getGreeting()}, ${firstName}.`

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const stream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1536,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? ''
            if (text) controller.enqueue(encoder.encode(text))
          }
        } finally {
          controller.close()
        }
      },
    })

    return new NextResponse(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[AI chat]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
