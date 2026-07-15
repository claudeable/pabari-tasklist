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

  // ── TASKS ──────────────────────────────────────────────────────────────
  try {
    const byStatus = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') GROUP BY status ORDER BY count::int DESC`
    )
    const overdue = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND due_date IS NOT NULL AND due_date != '' AND due_date < $1`,
      [now]
    )
    const dueToday = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND due_date = $1`,
      [now]
    )
    const byCompany = await query<{ company: string; count: string }>(
      `SELECT company, COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') GROUP BY company ORDER BY count::int DESC LIMIT 10`
    )
    const total = byStatus.reduce((s, r) => s + parseInt(r.count, 10), 0)
    lines.push(`## Task Overview`)
    lines.push(`Total open tasks: ${total}`)
    lines.push(`Overdue: ${parseInt(overdue[0]?.count ?? '0', 10)}`)
    lines.push(`Due today: ${parseInt(dueToday[0]?.count ?? '0', 10)}`)
    lines.push('')
    byStatus.forEach(r => lines.push(`- ${r.status}: ${r.count} tasks`))
    lines.push('')
    if (byCompany.length > 0) {
      lines.push(`Tasks by company:`)
      byCompany.forEach(r => lines.push(`- ${r.company}: ${r.count}`))
      lines.push('')
    }
  } catch { /**/ }

  try {
    const awaitingHK = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status='awaiting-hk-approval'`
    )
    const cnt = parseInt(awaitingHK[0]?.count ?? '0', 10)
    if (cnt > 0) {
      lines.push(`Tasks awaiting director approval: ${cnt}`)
      lines.push('')
    }
  } catch { /**/ }

  try {
    const overdueTasks = await query<{ particulars: string; company: string; responsible: string; due_date: string; priority: string }>(
      `SELECT particulars, company, responsible, due_date, priority FROM tasks
       WHERE status NOT IN ('resolved','expired') AND due_date IS NOT NULL AND due_date != '' AND due_date < $1
       ORDER BY due_date ASC LIMIT 10`,
      [now]
    )
    if (overdueTasks.length > 0) {
      lines.push(`Top overdue tasks:`)
      overdueTasks.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 80)} | owner: ${t.responsible} | due: ${t.due_date} | ${t.priority}`))
      lines.push('')
    }
  } catch { /**/ }

  // ── PETTY CASH (FORMS) ─────────────────────────────────────────────────
  try {
    const pcrs = await query<{
      req_no: string; employee_name: string; company: string;
      total_amount: string; status: string; created_at: string
    }>(`SELECT req_no, employee_name, company, total_amount::text, status, created_at
        FROM petty_cash_requests
        WHERE status NOT IN ('received','rejected')
        ORDER BY created_at DESC LIMIT 20`)

    if (pcrs.length > 0) {
      lines.push(`## Petty Cash Requests (${pcrs.length} active)`)
      pcrs.forEach(r => {
        const amt = Number(r.total_amount)
        const flag = amt >= 500000 ? ' 🔴 HIGH VALUE' : amt >= 100000 ? ' 🟡' : ''
        lines.push(`- ${r.req_no} | ${r.employee_name} | KES ${amt.toLocaleString()} [${r.company}] | ${r.status}${flag}`)
      })
      lines.push('')
    }

    // Summary counts by status
    const pcrByStatus = await query<{ status: string; count: string; total: string }>(
      `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(total_amount),0)::text AS total FROM petty_cash_requests WHERE status NOT IN ('received','rejected') GROUP BY status`
    )
    if (pcrByStatus.length > 0) {
      lines.push(`PCR status summary:`)
      pcrByStatus.forEach(r => lines.push(`- ${r.status}: ${r.count} requests | KES ${Number(r.total).toLocaleString()}`))
      lines.push('')
    }
  } catch { /**/ }

  // ── LEAVE REQUESTS (FORMS) ─────────────────────────────────────────────
  try {
    const leaves = await query<{
      employee_name: string; leave_type: string;
      date_from: string; date_to: string; days_requested: number; status: string; company: string
    }>(`SELECT employee_name, leave_type, date_from, date_to, days_requested, status, company
        FROM leave_requests
        WHERE status NOT IN ('approved','rejected')
        ORDER BY created_at DESC LIMIT 15`)

    if (leaves.length > 0) {
      lines.push(`## Leave Requests (${leaves.length} pending)`)
      leaves.forEach(l => lines.push(`- ${l.employee_name} | ${l.leave_type} | ${l.date_from} → ${l.date_to} (${l.days_requested}d) | ${l.company} | ${l.status}`))
      lines.push('')
    }
  } catch { /**/ }

  // ── DOCUMENTS ──────────────────────────────────────────────────────────
  try {
    const docs = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM documents`
    )
    const recentDocs = await query<{ name: string; folder: string; uploaded_by: string; created_at: string }>(
      `SELECT name, COALESCE(folder,'Uncategorised') AS folder, uploaded_by, created_at FROM documents ORDER BY created_at DESC LIMIT 10`
    )
    lines.push(`## Document Management`)
    lines.push(`Total documents: ${docs[0]?.count ?? 0}`)
    if (recentDocs.length > 0) {
      lines.push(`Recently uploaded:`)
      recentDocs.forEach(d => {
        const date = new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        lines.push(`- ${d.name} | ${d.folder} | by ${d.uploaded_by} | ${date}`)
      })
    }
    lines.push('')
  } catch { /**/ }

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

  const systemPrompt = `You are the Pabari Executive AI — a private decision intelligence assistant for senior leadership at Pabari Group.

You are speaking with ${user.name} (${user.role}).

You have real-time access to three live systems: Tasks, Forms (Petty Cash & Leave), and Documents.
Finance, Projects, and other modules are still in beta and you do NOT have data from them — if asked about those, let ${firstName} know they are not yet connected.

Here is the current live data:

${context}

## Your role:
You are an Executive Decision Assistant. Surface risks, priorities, and recommendations so ${firstName} can make fast, informed decisions.

## How you respond:
- Lead with what matters most: overdue tasks, high-value requests, pending approvals
- Be concise and direct — no filler
- When asked for a briefing, structure it: Tasks → Petty Cash → Leave → Documents → Risks
- Flag petty cash items over KES 100,000 and especially over KES 500,000
- For pending approvals, give a recommendation where possible
- Use bullet points for lists

## ERP Navigation:
- Tasks: /tasks
- Forms (Leave / Petty Cash): /forms
- Documents: /documents
- Pabari Centre: /centre

## Today: ${today()}, good ${getGreeting()}, ${firstName}.`

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
