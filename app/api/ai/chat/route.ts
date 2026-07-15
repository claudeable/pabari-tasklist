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

  // ── TASKS: top-level counts ─────────────────────────────────────────────
  try {
    const counts = await query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text AS count FROM tasks
       WHERE status NOT IN ('resolved','expired')
       GROUP BY status ORDER BY count::int DESC`
    )
    const total = counts.reduce((s, r) => s + parseInt(r.count, 10), 0)
    lines.push(`## Task Overview (${total} total open tasks)`)
    counts.forEach(r => lines.push(`- ${r.status}: ${r.count}`))
    lines.push('')
  } catch (e) { console.error('[AI] task counts', e) }

  // ── TASKS: needing HK comment (Harshil's main attention list) ───────────
  try {
    const needComment = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks
       WHERE status NOT IN ('resolved','expired')
         AND (hk_comment IS NULL OR TRIM(hk_comment) = '')`
    )
    const cnt = parseInt(needComment[0]?.count ?? '0', 10)
    if (cnt > 0) {
      lines.push(`Tasks needing your HK comment: ${cnt}`)
      // Show a sample of the most urgent ones (action-required first)
      const sample = await query<{ particulars: string; company: string; responsible: string; status: string; priority: string }>(
        `SELECT particulars, company, responsible, status, priority FROM tasks
         WHERE status NOT IN ('resolved','expired')
           AND (hk_comment IS NULL OR TRIM(hk_comment) = '')
         ORDER BY CASE status WHEN 'action-required' THEN 0 WHEN 'in-review' THEN 1 ELSE 2 END,
                  CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
         LIMIT 15`
      )
      sample.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible} | ${t.status} | ${t.priority}`))
      lines.push('')
    }
  } catch (e) { console.error('[AI] hk_comment', e) }

  // ── TASKS: action-required ──────────────────────────────────────────────
  try {
    const actionTasks = await query<{ particulars: string; company: string; responsible: string; due_date: string; priority: string }>(
      `SELECT particulars, company, responsible, COALESCE(due_date::text,'') AS due_date, priority
       FROM tasks WHERE status = 'action-required'
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, due_date ASC NULLS LAST
       LIMIT 20`
    )
    if (actionTasks.length > 0) {
      lines.push(`Action Required tasks (${actionTasks.length}) — these need immediate attention:`)
      actionTasks.forEach(t => {
        const due = t.due_date ? ` | due: ${t.due_date}` : ''
        lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible} | ${t.priority}${due}`)
      })
      lines.push('')
    }
  } catch (e) { console.error('[AI] action-required', e) }

  // ── TASKS: awaiting HK approval ─────────────────────────────────────────
  try {
    const awaitingApproval = await query<{ particulars: string; company: string; responsible: string }>(
      `SELECT particulars, company, responsible FROM tasks
       WHERE status = 'awaiting-hk-approval' LIMIT 15`
    )
    if (awaitingApproval.length > 0) {
      lines.push(`Awaiting your approval (${awaitingApproval.length}):`)
      awaitingApproval.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible}`))
      lines.push('')
    }
  } catch (e) { console.error('[AI] awaiting-approval', e) }

  // ── TASKS: overdue (with actual due_date set) ───────────────────────────
  try {
    const overdueTasks = await query<{ particulars: string; company: string; responsible: string; due_date: string; priority: string }>(
      `SELECT particulars, company, responsible, due_date::text, priority
       FROM tasks
       WHERE status NOT IN ('resolved','expired')
         AND due_date IS NOT NULL
         AND due_date < $1::date
       ORDER BY due_date ASC LIMIT 10`,
      [now]
    )
    if (overdueTasks.length > 0) {
      lines.push(`Overdue tasks (${overdueTasks.length} with missed due dates):`)
      overdueTasks.forEach(t => lines.push(`- [${t.company}] ${t.particulars.slice(0, 90)} | ${t.responsible} | due: ${t.due_date} | ${t.priority}`))
      lines.push('')
    }
  } catch (e) { console.error('[AI] overdue', e) }

  // ── TASKS: by company breakdown ─────────────────────────────────────────
  try {
    const byCompany = await query<{ company: string; total: string; action_req: string }>(
      `SELECT company,
              COUNT(*)::text AS total,
              COUNT(CASE WHEN status = 'action-required' THEN 1 END)::text AS action_req
       FROM tasks
       WHERE status NOT IN ('resolved','expired')
       GROUP BY company ORDER BY total::int DESC LIMIT 15`
    )
    if (byCompany.length > 0) {
      lines.push(`Tasks by company:`)
      byCompany.forEach(r => {
        const ar = parseInt(r.action_req, 10)
        lines.push(`- ${r.company}: ${r.total} open${ar > 0 ? `, ${ar} action-required` : ''}`)
      })
      lines.push('')
    }
  } catch (e) { console.error('[AI] byCompany', e) }

  // ── PETTY CASH (FORMS module — fully live) ─────────────────────────────
  try {
    const pcrs = await query<{
      req_no: string; employee_name: string; company: string;
      total_amount: string; status: string
    }>(`SELECT req_no, employee_name, company, total_amount::text, status
        FROM petty_cash_requests
        WHERE status NOT IN ('received','rejected')
        ORDER BY total_amount::numeric DESC LIMIT 20`)

    if (pcrs.length > 0) {
      lines.push(`## Petty Cash Requests — Forms module (${pcrs.length} active)`)
      pcrs.forEach(r => {
        const amt = Number(r.total_amount)
        const flag = amt >= 500000 ? ' 🔴 HIGH VALUE' : amt >= 100000 ? ' 🟡' : ''
        lines.push(`- ${r.req_no} | ${r.employee_name} | KES ${amt.toLocaleString()} [${r.company}] | ${r.status}${flag}`)
      })
    } else {
      lines.push(`## Petty Cash: No active requests.`)
    }
    lines.push('')
  } catch (e) { console.error('[AI] pcr', e) }

  // ── LEAVE REQUESTS (FORMS module — fully live) ─────────────────────────
  try {
    const leaves = await query<{
      employee_name: string; leave_type: string
      date_from: string; date_to: string; days_requested: number; status: string; company: string
    }>(`SELECT employee_name, leave_type, date_from::text, date_to::text, days_requested, status, company
        FROM leave_requests
        WHERE status NOT IN ('approved','rejected')
        ORDER BY created_at DESC LIMIT 15`)

    if (leaves.length > 0) {
      lines.push(`## Leave Requests — Forms module (${leaves.length} pending)`)
      leaves.forEach(l => lines.push(`- ${l.employee_name} | ${l.leave_type} | ${l.date_from} → ${l.date_to} (${l.days_requested}d) | ${l.company} | ${l.status}`))
    } else {
      lines.push(`## Leave: No pending requests.`)
    }
    lines.push('')
  } catch (e) { console.error('[AI] leave', e) }

  // ── DOCUMENTS ──────────────────────────────────────────────────────────
  try {
    const docCount = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM documents`)
    const recentDocs = await query<{ name: string; folder: string; uploaded_by: string; created_at: string }>(
      `SELECT name, COALESCE(folder,'Uncategorised') AS folder, uploaded_by, created_at FROM documents ORDER BY created_at DESC LIMIT 8`
    )
    lines.push(`## Documents (${docCount[0]?.count ?? 0} total)`)
    recentDocs.forEach(d => {
      const date = new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      lines.push(`- ${d.name} | ${d.folder} | ${d.uploaded_by} | ${date}`)
    })
    lines.push('')
  } catch (e) { console.error('[AI] docs', e) }

  // ── WEEKLY SUMMARY: PCR activity this week ─────────────────────────────
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const recentPCR = await query<{
      req_no: string; employee_name: string; company: string;
      total_amount: string; status: string; created_at: string
      hos_approved_at: string | null; hod_approved_at: string | null
      finance_approved_at: string | null; disbursed_at: string | null
      disbursed_by: string | null; disbursement_method: string | null
    }>(`SELECT req_no, employee_name, company, total_amount::text, status, created_at,
               hos_approved_at, hod_approved_at, finance_approved_at,
               disbursed_at, disbursed_by, disbursement_method
        FROM petty_cash_requests
        WHERE created_at >= $1::date
           OR hos_approved_at >= $1::date
           OR hod_approved_at >= $1::date
           OR finance_approved_at >= $1::date
           OR disbursed_at >= $1::date
        ORDER BY created_at DESC`,
      [weekAgo]
    )
    if (recentPCR.length > 0) {
      lines.push(`## PCR Activity This Week`)
      recentPCR.forEach(r => {
        const amt = Number(r.total_amount)
        let activity = `${r.status}`
        if (r.disbursed_at) activity = `DISBURSED via ${r.disbursement_method ?? 'cash'} by ${r.disbursed_by ?? 'unknown'}`
        else if (r.finance_approved_at) activity = `Finance approved — awaiting disbursement`
        else if (r.hod_approved_at) activity = `HOD approved`
        else if (r.hos_approved_at) activity = `HOS approved`
        lines.push(`- ${r.req_no} | ${r.employee_name} | KES ${amt.toLocaleString()} [${r.company}] | ${activity}`)
      })
      lines.push('')
    }
  } catch (e) { console.error('[AI] weekly pcr', e) }

  // ── WEEKLY SUMMARY: task performance per person ─────────────────────────
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    // Tasks resolved this week per person
    const resolved = await query<{ responsible: string; resolved_count: string }>(
      `SELECT responsible, COUNT(*)::text AS resolved_count
       FROM tasks
       WHERE status = 'resolved'
         AND updated_at >= $1::date
         AND responsible IS NOT NULL AND responsible != ''
       GROUP BY responsible ORDER BY resolved_count::int DESC LIMIT 15`,
      [weekAgo]
    )

    // Current open + action-required per person
    const openPerPerson = await query<{ responsible: string; open: string; action_req: string }>(
      `SELECT responsible,
              COUNT(*)::text AS open,
              COUNT(CASE WHEN status = 'action-required' THEN 1 END)::text AS action_req
       FROM tasks
       WHERE status NOT IN ('resolved','expired')
         AND responsible IS NOT NULL AND responsible != ''
       GROUP BY responsible ORDER BY open::int DESC LIMIT 20`
    )

    if (resolved.length > 0 || openPerPerson.length > 0) {
      lines.push(`## Weekly Team Performance`)
      lines.push(`Tasks resolved this week:`)
      if (resolved.length > 0) {
        resolved.forEach(r => lines.push(`- ${r.responsible}: ${r.resolved_count} resolved`))
      } else {
        lines.push(`- No tasks resolved this week`)
      }
      lines.push('')
      lines.push(`Current open tasks per person (open | action-required):`)
      openPerPerson.forEach(r => {
        const ar = parseInt(r.action_req, 10)
        lines.push(`- ${r.responsible}: ${r.open} open${ar > 0 ? ` | ${ar} action-required` : ''}`)
      })
      lines.push('')
    }
  } catch (e) { console.error('[AI] weekly performance', e) }

  // ── WEEKLY SUMMARY: activity log ───────────────────────────────────────
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const activitySummary = await query<{ user_name: string; action: string; count: string }>(
      `SELECT user_name, action, COUNT(*)::text AS count
       FROM activity_log
       WHERE created_at >= $1::date
       GROUP BY user_name, action
       ORDER BY count::int DESC LIMIT 30`,
      [weekAgo]
    )
    if (activitySummary.length > 0) {
      lines.push(`## System Activity This Week (by person)`)
      // Group by user
      const byUser: Record<string, string[]> = {}
      activitySummary.forEach(a => {
        if (!byUser[a.user_name]) byUser[a.user_name] = []
        byUser[a.user_name].push(`${a.action}(${a.count})`)
      })
      Object.entries(byUser).forEach(([name, actions]) => {
        lines.push(`- ${name}: ${actions.join(', ')}`)
      })
      lines.push('')
    }
  } catch (e) { console.error('[AI] weekly activity', e) }

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

LIVE DATA SOURCES (all fully connected and real-time):
1. Tasks — full task management system with ${firstName}'s attention queue
2. Forms — Petty Cash Requests (PCR) and Leave Requests
3. Documents — uploaded files and folders

NOT YET CONNECTED (beta): Finance module, Projects module. Tell ${firstName} these are not yet available if asked.

CRITICAL: You have complete real-time data below. Never say you lack access. Never confuse Petty Cash (Forms module) with Finance. PCR data IS available.

Here is today's live data (${today()}):

${context}

## Priority for ${firstName}:
The most important items are:
1. Tasks needing your HK comment — these are blocking team progress
2. Action Required tasks — these need your immediate decision
3. Tasks awaiting your approval
4. High-value Petty Cash Requests (≥ KES 100K)

## Response rules:
- Always lead with the numbers: how many tasks need comment, how many action-required
- Name specific tasks when relevant — use the data, don't be generic
- Flag high-priority and high-value items explicitly
- Give recommendations: which tasks to address first and why
- Be direct. No filler. Use the actual data provided.
- Structure briefings as: HK Attention → Action Required → Approvals → PCR → Leave → Documents
- For weekly summaries: include PCR approvals/disbursements, team task resolution rates, who is performing well, who has a backlog, and system activity per person

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
