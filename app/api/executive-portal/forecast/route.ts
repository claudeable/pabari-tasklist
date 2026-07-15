import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import Groq from 'groq-sdk'

export const dynamic = 'force-dynamic'

const EXEC_NAMES = ['harshil', 'benson']

export async function GET() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const firstName = (user.name?.split(' ')[0] ?? '').toLowerCase()
  if (user.role !== 'admin' && !EXEC_NAMES.includes(firstName))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // ── Compute real signals ─────────────────────────────────────────────────

  // 1. Task velocity: this week vs last week
  let velocity: { created_this_week: string; created_last_week: string; resolved_this_week: string; resolved_last_week: string } | null = null
  try {
    const rows = await query<{ created_this_week: string; created_last_week: string; resolved_this_week: string; resolved_last_week: string }>(`
      SELECT
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text            AS created_this_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '14 days'
                    AND created_at <  NOW() - INTERVAL '7 days'  THEN 1 END)::text            AS created_last_week,
        COUNT(CASE WHEN status='resolved' AND updated_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text AS resolved_this_week,
        COUNT(CASE WHEN status='resolved' AND updated_at >= NOW() - INTERVAL '14 days'
                    AND updated_at <  NOW() - INTERVAL '7 days'  THEN 1 END)::text            AS resolved_last_week
      FROM tasks`)
    velocity = rows[0] ?? null
  } catch { /**/ }

  // 2. Per-person deadline risk this week
  let deadlineRisk: { responsible: string; due_this_week: string; blocked: string }[] = []
  try {
    deadlineRisk = await query<{ responsible: string; due_this_week: string; blocked: string }>(`
      SELECT responsible,
        COUNT(*)::text AS due_this_week,
        COUNT(CASE WHEN status IN ('action-required','awaiting-hk-approval') THEN 1 END)::text AS blocked
      FROM tasks
      WHERE due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND status NOT IN ('resolved','expired')
        AND responsible IS NOT NULL AND responsible != ''
      GROUP BY responsible
      HAVING COUNT(*) > 0
      ORDER BY blocked::int DESC, due_this_week::int DESC
      LIMIT 8`)
  } catch { /**/ }

  // 3. PCR processing time this month vs last
  let pcrProcessing: { this_month: string; last_month: string } | null = null
  try {
    const rows = await query<{ this_month: string; last_month: string }>(`
      SELECT
        ROUND(AVG(CASE WHEN created_at >= DATE_TRUNC('month', NOW())
          THEN EXTRACT(DAY FROM disbursed_at - created_at) END))::int::text AS this_month,
        ROUND(AVG(CASE WHEN created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
          AND created_at < DATE_TRUNC('month', NOW())
          THEN EXTRACT(DAY FROM disbursed_at - created_at) END))::int::text AS last_month
      FROM petty_cash_requests WHERE disbursed_at IS NOT NULL`)
    pcrProcessing = rows[0] ?? null
  } catch { /**/ }

  // 4. Approval bottleneck by section
  let approvalBottleneck: { section: string; total: string; added_this_week: string }[] = []
  try {
    approvalBottleneck = await query<{ section: string; total: string; added_this_week: string }>(`
      SELECT section,
        COUNT(*)::text AS total,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text AS added_this_week
      FROM tasks
      WHERE status IN ('action-required','awaiting-hk-approval')
        AND section IS NOT NULL AND section != ''
      GROUP BY section
      ORDER BY total::int DESC
      LIMIT 5`)
  } catch { /**/ }

  // 5. Highest-risk aging tasks (oldest, no HK comment)
  let highRisk: { particulars: string; responsible: string; company: string; days_open: string; priority: string }[] = []
  try {
    highRisk = await query<{ particulars: string; responsible: string; company: string; days_open: string; priority: string }>(`
      SELECT particulars, responsible, company,
        GREATEST(0, EXTRACT(DAY FROM NOW() - created_at))::int::text AS days_open,
        priority
      FROM tasks
      WHERE status NOT IN ('resolved','expired')
        AND (hk_comment IS NULL OR TRIM(hk_comment) = '')
      ORDER BY created_at ASC
      LIMIT 5`)
  } catch { /**/ }

  // 6. Workload distribution
  let workload: { responsible: string; open: string }[] = []
  try {
    workload = await query<{ responsible: string; open: string }>(`
      SELECT responsible, COUNT(*)::text AS open
      FROM tasks
      WHERE status NOT IN ('resolved','expired')
        AND responsible IS NOT NULL AND responsible != ''
      GROUP BY responsible
      ORDER BY open::int DESC
      LIMIT 8`)
  } catch { /**/ }

  // 7. Overview snapshot
  let overview: { total: string; action_req: string; hk_queue: string } | null = null
  try {
    const rows = await query<{ total: string; action_req: string; hk_queue: string }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(CASE WHEN status='action-required' THEN 1 END)::text AS action_req,
        COUNT(CASE WHEN hk_comment IS NULL OR TRIM(hk_comment)='' THEN 1 END)::text AS hk_queue
      FROM tasks WHERE status NOT IN ('resolved','expired')`)
    overview = rows[0] ?? null
  } catch { /**/ }

  // 8. Leave pending
  let leavePending = 0
  try {
    const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status NOT IN ('approved','rejected')`)
    leavePending = parseInt(rows[0]?.count ?? '0', 10)
  } catch { /**/ }

  // ── Build Groq prompt ────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const context = `
Today: ${today}
Organisation: Pabari Group (multi-company ERP)

TASK VELOCITY (this week vs last week)
Created: ${velocity?.created_this_week ?? '?'} this week / ${velocity?.created_last_week ?? '?'} last week
Resolved: ${velocity?.resolved_this_week ?? '?'} this week / ${velocity?.resolved_last_week ?? '?'} last week

BACKLOG OVERVIEW
Total open: ${overview?.total ?? '?'} | Action required: ${overview?.action_req ?? '?'} | HK comment queue: ${overview?.hk_queue ?? '?'}

DEADLINE RISK (tasks due within 7 days, per person)
${deadlineRisk.length ? deadlineRisk.map(r => `${r.responsible}: ${r.due_this_week} due, ${r.blocked} blocked on approval`).join('\n') : 'No tasks with due dates this week'}

APPROVAL BOTTLENECK BY SECTION
${approvalBottleneck.length ? approvalBottleneck.map(r => `${r.section}: ${r.total} pending, ${r.added_this_week} added this week`).join('\n') : 'None'}

HIGHEST RISK TASKS (oldest unresolved, no HK comment)
${highRisk.length ? highRisk.map(r => `"${r.particulars.slice(0, 60)}" — ${r.responsible} @ ${r.company}, ${r.days_open} days open, ${r.priority} priority`).join('\n') : 'None'}

TEAM WORKLOAD (open tasks per person)
${workload.map(r => `${r.responsible}: ${r.open} open`).join(' | ')}

PCR PROCESSING TIME (submission to disbursement)
This month avg: ${pcrProcessing?.this_month ?? 'N/A'} days | Last month avg: ${pcrProcessing?.last_month ?? 'N/A'} days

LEAVE REQUESTS PENDING APPROVAL: ${leavePending}
`.trim()

  const systemPrompt = `You are Pabari Intelligence — an executive forecasting engine embedded in Pabari Group's ERP.
You receive live operational signals and generate short, sharp, forward-looking forecast statements for the executive chairman.

OUTPUT FORMAT:
- Return exactly 5 forecast statements
- Each on its own line, no numbers, no bullets, no markdown
- Each under 30 words
- Every statement must be forward-looking: what will happen, what is at risk, what is trending
- Base every statement strictly on the data given — no invented numbers
- Name specific people and sections from the data where relevant
- Tone: precise, confident, intelligence-briefing style — not chatty
- Never start with "I", "We", or "The system"
- Focus on: bottlenecks about to worsen, deadline risks, workload imbalances, processing trends, highest-aging risks`

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: context },
      ],
    })
    const raw = completion.choices[0]?.message?.content ?? ''
    const forecasts = raw
      .split('\n')
      .map(l => l.trim().replace(/^[-•*\d.]+\s*/, ''))
      .filter(l => l.length > 15)
      .slice(0, 5)

    return NextResponse.json({ forecasts, generatedAt: new Date().toISOString() })
  } catch (e) {
    console.error('Forecast error:', e)
    return NextResponse.json({ forecasts: [], generatedAt: new Date().toISOString(), error: 'AI unavailable' })
  }
}
