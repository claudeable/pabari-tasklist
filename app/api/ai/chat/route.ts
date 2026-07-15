import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'

const EXEC_NAMES = ['harshil', 'benson', 'pedro']

const today = () => new Date().toISOString().slice(0, 10)
const fmt   = (n: number) => n.toLocaleString()

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
  const firstName = user.name?.split(' ')[0] ?? user.name
  const lines: string[] = [
    `## Executive Profile`,
    `Name: ${user.name}`,
    `Role: ${user.role}`,
    `Department: ${user.department}`,
    `Today: ${now}`,
    `Time: ${getGreeting()}`,
    '',
  ]

  // Pending PCRs with details
  try {
    const pcrs = await query<{
      id: number; req_no: string; employee_name: string; company: string;
      total_amount: string; status: string; form_type: string; created_at: string
    }>(`SELECT id, req_no, employee_name, company, total_amount::text, status, form_type, created_at
        FROM petty_cash_requests
        WHERE status NOT IN ('received','rejected','disbursed')
        ORDER BY created_at DESC LIMIT 20`)

    if (pcrs.length > 0) {
      lines.push(`## Pending Petty Cash Requests (${pcrs.length})`)
      pcrs.forEach(r => {
        const amt = Number(r.total_amount)
        const flag = amt >= 500000 ? ' 🔴 HIGH VALUE' : amt >= 100000 ? ' 🟡' : ''
        lines.push(`- ${r.req_no} | ${r.employee_name} | KES ${fmt(amt)} [${r.company}] | Status: ${r.status}${flag}`)
      })
      lines.push('')
      const highValue = pcrs.filter(r => Number(r.total_amount) >= 500000)
      if (highValue.length > 0) {
        lines.push(`⚠️ HIGH VALUE (≥KES 500K): ${highValue.length} request(s) awaiting decision`)
        lines.push('')
      }
    }
  } catch { /**/ }

  // Pending leave requests
  try {
    const leaves = await query<{
      id: number; employee_name: string; leave_type: string;
      date_from: string; date_to: string; days_requested: number; status: string; company: string
    }>(`SELECT id, employee_name, leave_type, date_from, date_to, days_requested, status, company
        FROM leave_requests
        WHERE status NOT IN ('approved','rejected')
        ORDER BY created_at DESC LIMIT 10`)

    if (leaves.length > 0) {
      lines.push(`## Pending Leave Requests (${leaves.length})`)
      leaves.forEach(l => {
        lines.push(`- ${l.employee_name} | ${l.leave_type} | ${l.date_from} to ${l.date_to} (${l.days_requested} days) | ${l.company} | Status: ${l.status}`)
      })
      lines.push('')
    }
  } catch { /**/ }

  // Tasks overview
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
      `SELECT company, COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') GROUP BY company ORDER BY count::int DESC LIMIT 8`
    )
    const total = byStatus.reduce((s, r) => s + parseInt(r.count, 10), 0)
    lines.push(`## Task Intelligence`)
    lines.push(`Total open tasks: ${total}`)
    lines.push(`Overdue: ${parseInt(overdue[0]?.count ?? '0', 10)}`)
    lines.push(`Due today: ${parseInt(dueToday[0]?.count ?? '0', 10)}`)
    byStatus.forEach(r => lines.push(`- ${r.status}: ${r.count}`))
    lines.push('')
    if (byCompany.length > 0) {
      lines.push(`Tasks by company:`)
      byCompany.forEach(r => lines.push(`- ${r.company}: ${r.count} tasks`))
      lines.push('')
    }

    // My personal tasks
    const myOpen = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND LOWER(responsible)=LOWER($1)`,
      [user.name]
    )
    const myOverdue = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND due_date < $1 AND LOWER(responsible)=LOWER($2)`,
      [now, user.name]
    )
    lines.push(`My open tasks: ${myOpen[0]?.count ?? 0} (${myOverdue[0]?.count ?? 0} overdue)`)
    lines.push('')
  } catch { /**/ }

  // Finance snapshot
  try {
    const inv = await query<{ status: string; count: string; total: string }>(
      `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS total FROM invoices GROUP BY status`
    )
    if (inv.length > 0) {
      lines.push(`## Finance Snapshot`)
      inv.forEach(r => lines.push(`- ${r.status}: ${r.count} invoices | KES ${fmt(Number(r.total))}`))
      lines.push('')
    }
  } catch { /**/ }

  // HK-specific awaiting approval
  try {
    const awaiting = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status='awaiting-hk-approval'`
    )
    const needComment = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND (hk_comment IS NULL OR TRIM(hk_comment)='')`
    )
    const cnt = parseInt(awaiting[0]?.count ?? '0', 10)
    const nc  = parseInt(needComment[0]?.count ?? '0', 10)
    if (cnt > 0 || nc > 0) {
      lines.push(`## Director Actions Required`)
      if (cnt > 0) lines.push(`- Tasks awaiting your approval: ${cnt}`)
      if (nc > 0)  lines.push(`- Tasks needing your comment: ${nc}`)
      lines.push('')
    }
  } catch { /**/ }

  // Recent activity
  try {
    const activity = await query<{ user_name: string; action: string; details: string; created_at: string }>(
      `SELECT user_name, action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 10`
    )
    if (activity.length > 0) {
      lines.push(`## Recent Activity (last 10 events)`)
      activity.forEach(a => {
        const time = new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        lines.push(`- ${time} | ${a.user_name} | ${a.action} | ${(a.details ?? '').slice(0, 80)}`)
      })
      lines.push('')
    }
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

You have real-time access to the company's operational data:

${context}

## Your role:
You are an Executive Decision Assistant. You do NOT just answer questions — you proactively surface risks, priorities, and recommendations so that ${firstName} can make fast, well-informed decisions.

## How you respond:
- Lead with what matters most: risks, deadlines, high-value decisions
- Be direct and concise — no corporate filler
- When asked for a briefing, structure it clearly: Approvals → Finance → Operations → People → Risks
- When summarizing a request (PCR, leave, project), give a recommendation: Approve / Hold / Reject — and the reason
- Always flag items over KES 500,000 or items with time pressure
- Use bullet points for lists, bold for key figures
- When the data supports it, give a recommendation — but always make clear the decision is ${firstName}'s

## ERP Navigation:
- Tasks: /tasks
- Forms (Leave / Petty Cash): /forms
- Finance: /finance
- Projects: /projects
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
