import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['admin', 'director', 'ceo', 'manager']

export async function POST(req: NextRequest) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!ALLOWED_ROLES.includes(user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { question } = await req.json()
  if (!question?.trim()) return NextResponse.json({ error: 'No question' }, { status: 400 })

  let context = ''
  try {
    const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10)

    const [overview, escalated, workload, activity, weekly] = await Promise.all([
      query<{ pending: string; action_req: string; hk_queue: string; long_running: string }>(`
        SELECT
          COUNT(CASE WHEN status NOT IN ('resolved','expired','archived') THEN 1 END)::text AS pending,
          COUNT(CASE WHEN status='action-required' THEN 1 END)::text AS action_req,
          COUNT(CASE WHEN hk_escalation_type IS NOT NULL AND hk_escalation_type!='none' THEN 1 END)::text AS hk_queue,
          COUNT(CASE WHEN status NOT IN ('resolved','expired','archived') AND created_at < NOW() - INTERVAL '30 days' THEN 1 END)::text AS long_running
        FROM tasks WHERE status NOT IN ('resolved','expired','archived')
      `),
      query<{ particulars: string; company: string; responsible: string; hk_escalation_type: string; hk_escalation_note: string }>(`
        SELECT particulars, company, responsible, hk_escalation_type, hk_escalation_note
        FROM tasks
        WHERE hk_escalation_type IS NOT NULL AND hk_escalation_type != 'none'
          AND status NOT IN ('resolved','expired','archived')
        ORDER BY CASE hk_escalation_type WHEN 'decision' THEN 0 WHEN 'action' THEN 1 WHEN 'guidance' THEN 2 ELSE 3 END
        LIMIT 10
      `),
      query<{ responsible: string; open: string }>(`
        SELECT responsible, COUNT(*)::text AS open
        FROM tasks WHERE status NOT IN ('resolved','expired','archived') AND responsible != ''
        GROUP BY responsible ORDER BY open::int DESC LIMIT 8
      `),
      query<{ user_name: string; action: string; details: string; created_at: string }>(`
        SELECT user_name, action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 15
      `),
      query<{ resolved_week: string; overdue: string }>(`
        SELECT
          COUNT(CASE WHEN status='resolved' AND LEFT(updated_at::text,10) >= $1 THEN 1 END)::text AS resolved_week,
          COUNT(CASE WHEN status NOT IN ('resolved','expired','archived') AND due_date < CURRENT_DATE THEN 1 END)::text AS overdue
        FROM tasks
      `, [weekAgo]),
    ])

    context = `
Date: ${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
Organisation: Pabari Group
You are assisting: ${user.name} (${user.role})

TASK OVERVIEW:
- Total pending tasks: ${overview[0]?.pending ?? '?'}
- Action required: ${overview[0]?.action_req ?? '?'}
- Escalated to you: ${overview[0]?.hk_queue ?? '?'}
- Long-running (30+ days open): ${overview[0]?.long_running ?? '?'}
- Resolved this week: ${weekly[0]?.resolved_week ?? '?'}
- Overdue: ${weekly[0]?.overdue ?? '?'}

YOUR ESCALATED ITEMS:
${escalated.length > 0
  ? escalated.map(t => `- [${t.hk_escalation_type.toUpperCase()}] "${t.particulars}" · ${t.company} · Owner: ${t.responsible}${t.hk_escalation_note ? ` · Note: ${t.hk_escalation_note}` : ''}`).join('\n')
  : '- None currently escalated to you'}

TEAM WORKLOAD:
${workload.map(w => `- ${w.responsible}: ${w.open} open tasks`).join('\n')}

RECENT ACTIVITY:
${activity.map(a => {
  const ts = new Date(a.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `[${ts}] ${a.user_name}: ${a.action}${a.details ? ` — ${a.details.slice(0, 70)}` : ''}`
}).join('\n')}
`.trim()
  } catch (e) {
    console.error('[intelligence/ask] context error:', e)
    context = 'Live data temporarily unavailable.'
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ answer: 'AI assistant is not configured. Please contact your system administrator.' })
  }

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 350,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: `You are Pabari Intelligence — the executive AI assistant for Pabari Group.
Answer questions concisely and precisely using the live data provided.
Be direct and actionable. Max 3-4 sentences unless a list is clearly required.
Use the actual numbers from the data — never invent figures.
When listing items, use a short bullet format.
Address matters by task name or person name as provided in the data.`,
        },
        { role: 'user', content: `Data context:\n${context}\n\nExecutive question: ${question}` },
      ],
    })
    const answer = completion.choices[0]?.message?.content?.trim() ?? 'Unable to generate a response at this time.'
    return NextResponse.json({ answer })
  } catch (e) {
    console.error('[intelligence/ask] groq error:', e)
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 })
  }
}
