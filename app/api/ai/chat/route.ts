import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'

const EXEC_NAMES = ['harshil', 'benson', 'pedro']

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

async function buildContext(user: Awaited<ReturnType<typeof verifyToken>>) {
  if (!user) return ''
  const now = today()
  const lines: string[] = [
    `## Executive Profile`,
    `Name: ${user.name}`,
    `Role: ${user.role}`,
    `Today: ${now}`,
    `Time: ${getGreeting()}`,
    '',
  ]

  // ── TASKS: counts & status breakdown ───────────────────────────────────
  try {
    const byStatus = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM tasks
       WHERE status NOT IN ('resolved','expired')
       GROUP BY status ORDER BY count::int DESC`
    )
    const total = byStatus.reduce((s, r) => s + parseInt(r.count, 10), 0)
    lines.push(`## Task Overview`)
    lines.push(`Total open tasks: ${total}`)
    byStatus.forEach(r => lines.push(`- ${r.status}: ${r.count}`))
    lines.push('')
  } catch (e) { console.error('[AI tasks byStatus]', e) }

  // ── TASKS: overdue ──────────────────────────────────────────────────────
  try {
    const overdueTasks = await query<{ particulars: string; company: string; responsible: string; due_date: string; priority: string; status: string }>(
      `SELECT particulars, company, responsible, due_date::text, priority, status
       FROM tasks
       WHERE status NOT IN ('resolved','expired')
         AND due_date IS NOT NULL
         AND due_date < $1::date
       ORDER BY due_date ASC LIMIT 15`,
      [now]
    )
    if (overdueTasks.length > 0) {
      lines.push(`Overdue tasks (${overdueTasks.length}):`)
      overdueTasks.forEach(t => {
        lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | owner: ${t.responsible} | due: ${t.due_date} | ${t.priority} priority | ${t.status}`)
      })
      lines.push('')
    }
  } catch (e) { console.error('[AI tasks overdue]', e) }

  // ── TASKS: due today ────────────────────────────────────────────────────
  try {
    const dueTodayTasks = await query<{ particulars: string; company: string; responsible: string; priority: string }>(
      `SELECT particulars, company, responsible, priority
       FROM tasks
       WHERE status NOT IN ('resolved','expired')
         AND due_date = $1::date`,
      [now]
    )
    if (dueTodayTasks.length > 0) {
      lines.push(`Due today (${dueTodayTasks.length}):`)
      dueTodayTasks.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible} | ${t.priority}`))
      lines.push('')
    }
  } catch (e) { console.error('[AI tasks dueToday]', e) }

  // ── TASKS: by company ───────────────────────────────────────────────────
  try {
    const byCompany = await query<{ company: string; open: string; overdue: string }>(
      `SELECT company,
              COUNT(*)::text AS open,
              COUNT(CASE WHEN due_date IS NOT NULL AND due_date < $1::date THEN 1 END)::text AS overdue
       FROM tasks
       WHERE status NOT IN ('resolved','expired')
       GROUP BY company ORDER BY open::int DESC LIMIT 12`,
      [now]
    )
    if (byCompany.length > 0) {
      lines.push(`Tasks by company:`)
      byCompany.forEach(r => lines.push(`- ${r.company}: ${r.open} open, ${r.overdue} overdue`))
      lines.push('')
    }
  } catch (e) { console.error('[AI tasks byCompany]', e) }

  // ── TASKS: awaiting director approval ───────────────────────────────────
  try {
    const awaitingApproval = await query<{ particulars: string; company: string; responsible: string }>(
      `SELECT particulars, company, responsible FROM tasks WHERE status='awaiting-hk-approval' LIMIT 10`
    )
    if (awaitingApproval.length > 0) {
      lines.push(`Awaiting your approval (${awaitingApproval.length}):`)
      awaitingApproval.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible}`))
      lines.push('')
    }
  } catch (e) { console.error('[AI tasks awaitingApproval]', e) }

  // ── TASKS: high priority ────────────────────────────────────────────────
  try {
    const criticalTasks = await query<{ particulars: string; company: string; responsible: string; status: string; due_date: string }>(
      `SELECT particulars, company, responsible, status, COALESCE(due_date::text,'') AS due_date
       FROM tasks
       WHERE status NOT IN ('resolved','expired') AND priority = 'critical'
       ORDER BY due_date ASC NULLS LAST LIMIT 10`
    )
    if (criticalTasks.length > 0) {
      lines.push(`Critical priority tasks (${criticalTasks.length}):`)
      criticalTasks.forEach(t => {
        const due = t.due_date ? ` | due: ${t.due_date}` : ''
        lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible} | ${t.status}${due}`)
      })
      lines.push('')
    }
  } catch (e) { console.error('[AI tasks critical]', e) }

  // ── PETTY CASH (FORMS) ─────────────────────────────────────────────────
  try {
    const pcrs = await query<{
      req_no: string; employee_name: string; company: string;
      total_amount: string; status: string; created_at: string
    }>(`SELECT req_no, employee_name, company, total_amount::text, status, created_at
        FROM petty_cash_requests
        WHERE status NOT IN ('received','rejected')
        ORDER BY total_amount::numeric DESC LIMIT 20`)

    if (pcrs.length > 0) {
      lines.push(`## Petty Cash Requests (${pcrs.length} active)`)
      pcrs.forEach(r => {
        const amt = Number(r.total_amount)
        const flag = amt >= 500000 ? ' 🔴 HIGH VALUE' : amt >= 100000 ? ' 🟡' : ''
        lines.push(`- ${r.req_no} | ${r.employee_name} | KES ${amt.toLocaleString()} [${r.company}] | ${r.status}${flag}`)
      })
      lines.push('')
    } else {
      lines.push(`## Petty Cash: No active requests.`)
      lines.push('')
    }
  } catch (e) { console.error('[AI pcr]', e) }

  // ── LEAVE REQUESTS ──────────────────────────────────────────────────────
  try {
    const leaves = await query<{
      employee_name: string; leave_type: string;
      date_from: string; date_to: string; days_requested: number; status: string; company: string
    }>(`SELECT employee_name, leave_type, date_from::text, date_to::text, days_requested, status, company
        FROM leave_requests
        WHERE status NOT IN ('approved','rejected')
        ORDER BY created_at DESC LIMIT 15`)

    if (leaves.length > 0) {
      lines.push(`## Leave Requests (${leaves.length} pending)`)
      leaves.forEach(l => lines.push(`- ${l.employee_name} | ${l.leave_type} | ${l.date_from} → ${l.date_to} (${l.days_requested}d) | ${l.company} | ${l.status}`))
      lines.push('')
    } else {
      lines.push(`## Leave: No pending requests.`)
      lines.push('')
    }
  } catch (e) { console.error('[AI leave]', e) }

  // ── DOCUMENTS ──────────────────────────────────────────────────────────
  try {
    const docCount = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM documents`)
    const recentDocs = await query<{ name: string; folder: string; uploaded_by: string; created_at: string }>(
      `SELECT name, COALESCE(folder,'Uncategorised') AS folder, uploaded_by, created_at FROM documents ORDER BY created_at DESC LIMIT 8`
    )
    lines.push(`## Documents`)
    lines.push(`Total: ${docCount[0]?.count ?? 0} documents`)
    recentDocs.forEach(d => {
      const date = new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      lines.push(`- ${d.name} | ${d.folder} | ${d.uploaded_by} | ${date}`)
    })
    lines.push('')
  } catch (e) { console.error('[AI docs]', e) }

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

  const context = await buildContext(user)
  const firstName = user.name?.split(' ')[0] ?? user.name

  const systemPrompt = `You are the Pabari Executive AI — a private decision intelligence assistant for ${user.name} (${user.role}) at Pabari Group.

You have FULL real-time access to three live systems: Tasks, Forms (Petty Cash & Leave), and Documents.
Finance and Projects modules are still in beta — if asked about those, say they are not yet connected.

IMPORTANT: You DO have complete task data below. Never say you lack access to tasks — use the data provided.

Here is today's live data (${today()}):

${context}

## Your role:
You are an Executive Decision Assistant. Give ${firstName} fast, actionable intelligence.

## Response style:
- When briefing: Tasks → PCR → Leave → Documents → Risks
- Always cite real numbers from the data above
- Flag critical and overdue items prominently
- For approvals, give a recommendation (Approve / Hold / Reject) with a reason
- Flag any PCR over KES 100,000 — especially over KES 500,000
- Be concise. No filler. No "I recommend checking /tasks" — you already have the data.

## ERP links:
- Tasks: /tasks | Forms: /forms | Documents: /documents | Centre: /centre

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
