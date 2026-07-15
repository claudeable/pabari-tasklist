import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const today = () => new Date().toISOString().slice(0, 10)
const fmt   = (n: number) => n.toLocaleString()

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

async function buildContext(user: Awaited<ReturnType<typeof verifyToken>>) {
  if (!user) return ''
  const now    = today()
  const isAdmin = user.role === 'admin'
  const firstName = user.name?.split(' ')[0] ?? user.name
  const isHK   = isAdmin || (user.role === 'director' && firstName.toLowerCase() === 'harshil')
  const canSeeFinance = isAdmin || firstName.toLowerCase() === 'harshil' || firstName.toLowerCase() === 'benson'

  const lines: string[] = [
    `## Current User`,
    `Name: ${user.name}`,
    `Role: ${user.role}`,
    `Department: ${user.department}`,
    `Email: ${user.email}`,
    `Today's date: ${now}`,
    `Time of day: ${getGreeting()}`,
    '',
  ]

  // My tasks
  try {
    const myOpen = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND LOWER(responsible)=LOWER($1)`,
      [user.name]
    )
    const myOverdue = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND due_date IS NOT NULL AND due_date != '' AND due_date < $1 AND LOWER(responsible)=LOWER($2)`,
      [now, user.name]
    )
    const myDueToday = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND due_date=$1 AND LOWER(responsible)=LOWER($2)`,
      [now, user.name]
    )
    const myActionRequired = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status='action-required' AND LOWER(responsible)=LOWER($1)`,
      [user.name]
    )
    lines.push(`## My Task Summary`)
    lines.push(`Open tasks assigned to me: ${parseInt(myOpen[0]?.count ?? '0', 10)}`)
    lines.push(`Overdue tasks: ${parseInt(myOverdue[0]?.count ?? '0', 10)}`)
    lines.push(`Due today: ${parseInt(myDueToday[0]?.count ?? '0', 10)}`)
    lines.push(`Action required: ${parseInt(myActionRequired[0]?.count ?? '0', 10)}`)
    lines.push('')

    // Top 10 open tasks
    const tasks = await query<{ id: string; particulars: string; company: string; status: string; due_date: string; priority: string }>(
      `SELECT id::text, particulars, company, status, COALESCE(due_date,'') AS due_date, priority FROM tasks
       WHERE status NOT IN ('resolved','expired') AND LOWER(responsible)=LOWER($1)
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, due_date NULLS LAST LIMIT 10`,
      [user.name]
    )
    if (tasks.length > 0) {
      lines.push(`## My Top Open Tasks`)
      tasks.forEach(t => {
        const due = t.due_date ? ` (due: ${t.due_date})` : ''
        const overdue = t.due_date && t.due_date < now ? ' ⚠️ OVERDUE' : ''
        lines.push(`- [${t.company}] ${t.particulars.slice(0, 100)} | status: ${t.status} | priority: ${t.priority}${due}${overdue}`)
      })
      lines.push('')
    }
  } catch { /**/ }

  // HK-specific context
  if (isHK) {
    try {
      const needComment = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') AND (hk_comment IS NULL OR TRIM(hk_comment)='')`
      )
      const awaitingApproval = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tasks WHERE status='awaiting-hk-approval'`
      )
      lines.push(`## HK Dashboard (Director View)`)
      lines.push(`Tasks needing your HK comment: ${parseInt(needComment[0]?.count ?? '0', 10)}`)
      lines.push(`Tasks awaiting your approval: ${parseInt(awaitingApproval[0]?.count ?? '0', 10)}`)
      lines.push('')

      // Company task breakdown
      const byCompany = await query<{ company: string; count: string }>(
        `SELECT company, COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired') GROUP BY company ORDER BY count::int DESC LIMIT 10`
      )
      if (byCompany.length > 0) {
        lines.push(`## Active Tasks by Company`)
        byCompany.forEach(r => lines.push(`- ${r.company}: ${r.count} tasks`))
        lines.push('')
      }
    } catch { /**/ }
  }

  // Pending approvals
  try {
    const uid       = parseInt(String(user.id ?? ''), 10) || 0
    const firstName2 = (user.name?.split(' ')[0] ?? '').toLowerCase()
    const email     = user.email?.toLowerCase() ?? ''
    const isHR      = user.department === 'HR' || isAdmin

    let leaveCount = 0; let pcrCount = 0
    if (isHR) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status='pending_hr'`)
      leaveCount += parseInt(r[0]?.count ?? '0', 10)
    }
    if (isAdmin) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status='pending_hk'`)
      leaveCount += parseInt(r[0]?.count ?? '0', 10)
    }
    const pcrChecks = [
      email === 'rkrishnan@usm.co.ke'     ? `status='pending_hos' AND form_type='general'` : null,
      email === 'ssuresh@kwale-group.com'  ? `status='pending_hos' AND form_type='kiscol'` : null,
      email === 'ahmad@usm.co.ke'          ? `status='pending_hod' AND form_type='kiscol'` : null,
      email === 'ateferi@kwale-group.com'  ? `status='pending_finance' AND form_type='general'` : null,
    ].filter(Boolean) as string[]
    for (const cond of pcrChecks) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE ${cond}`)
      pcrCount += parseInt(r[0]?.count ?? '0', 10)
    }
    if (uid > 0 || firstName2) {
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hod' AND form_type='general' AND (hod_id=$1 OR LOWER(SPLIT_PART(hod_name,' ',1))=LOWER($2))`,
        [uid, firstName2]
      )
      pcrCount += parseInt(r[0]?.count ?? '0', 10)
    }
    if (leaveCount > 0 || pcrCount > 0) {
      lines.push(`## Pending Approvals`)
      if (leaveCount > 0) lines.push(`- Leave requests awaiting your review: ${leaveCount}`)
      if (pcrCount > 0)   lines.push(`- Petty cash requests awaiting your approval: ${pcrCount}`)
      lines.push('')
    }
  } catch { /**/ }

  // Finance snapshot
  if (canSeeFinance) {
    try {
      const rows = await query<{ status: string; count: string; total: string }>(
        `SELECT status, COUNT(*)::text AS count, COALESCE(SUM(amount),0)::text AS total FROM invoices GROUP BY status`
      )
      if (rows.length > 0) {
        lines.push(`## Finance Snapshot`)
        rows.forEach(r => lines.push(`- Invoices ${r.status}: ${r.count} (KES ${fmt(Number(r.total))})`))
        lines.push('')
      }
    } catch { /**/ }
  }

  // Recent activity
  try {
    const activity = await query<{ user_name: string; action: string; details: string; created_at: string }>(
      `SELECT user_name, action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 15`
    )
    if (activity.length > 0) {
      lines.push(`## Recent System Activity (last 15 events)`)
      activity.forEach(a => {
        const time = new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
        lines.push(`- ${a.user_name} | ${a.action} | ${(a.details ?? '').slice(0, 80)} | ${time}`)
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

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[]
  }
  if (!messages?.length) return NextResponse.json({ error: 'No messages' }, { status: 400 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured — add ANTHROPIC_API_KEY to Railway environment variables.' }, { status: 503 })
  }

  const context = await buildContext(user)
  const firstName = user.name?.split(' ')[0] ?? user.name

  const systemPrompt = `You are Pabari AI, the enterprise operating assistant for Pabari Group ERP.

You are talking to ${user.name} (${user.role}, ${user.department} department).

You have real-time access to their work data. Here is their current work context:

${context}

## Your capabilities:
- Answer questions about their tasks, approvals, deadlines, and work
- Help prioritise today's work
- Summarise what's pending or overdue
- Explain ERP navigation (tell them which page to go to)
- Answer questions about colleagues' work (only if their role permits seeing it)
- Generate summaries of business activity
- Help draft messages, task descriptions, or work updates

## ERP Navigation links (share these as clickable markdown links when relevant):
- Tasks: /tasks
- Portal (Dashboard): /
- Pabari Centre: /centre
- Forms (Leave / Petty Cash): /forms
- Finance (Invoices / LPO): /finance
- Projects: /projects
- Documents: /documents
- Reports: /reports

## Rules:
- Be concise and direct — this is a work tool, not a conversation app
- Always use the user's real data from the context above
- If asked about data you don't have, say so honestly
- Never expose data outside the user's permissions
- When listing tasks or items, use bullet points
- For navigation requests, give the direct link
- Address the user as ${firstName}
- Today is ${today()}, good ${getGreeting()}`

  const stream = await client.messages.stream({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system:     systemPrompt,
    messages:   messages.map(m => ({ role: m.role, content: m.content })),
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
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
}
