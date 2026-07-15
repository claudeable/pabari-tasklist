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

  // ── 1. Task velocity ─────────────────────────────────────────────────────
  let velocity: { created_this_week: string; created_last_week: string; resolved_this_week: string; resolved_last_week: string } | null = null
  try {
    const rows = await query<{ created_this_week: string; created_last_week: string; resolved_this_week: string; resolved_last_week: string }>(`
      SELECT
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text AS created_this_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '14 days'
                    AND created_at < NOW() - INTERVAL '7 days' THEN 1 END)::text  AS created_last_week,
        COUNT(CASE WHEN status='resolved' AND updated_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text AS resolved_this_week,
        COUNT(CASE WHEN status='resolved' AND updated_at >= NOW() - INTERVAL '14 days'
                    AND updated_at < NOW() - INTERVAL '7 days' THEN 1 END)::text  AS resolved_last_week
      FROM tasks`)
    velocity = rows[0] ?? null
  } catch { /**/ }

  // ── 2. Deadline risk this week per person ────────────────────────────────
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

  // ── 3. PCR processing time ───────────────────────────────────────────────
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

  // ── 4. Approval bottleneck by section ───────────────────────────────────
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

  // ── 5. Oldest unresolved tasks — with EXACT priority label ──────────────
  //    NOTE: sorted by age only. Priority field shows the ACTUAL task priority.
  //    Do NOT treat "old" as meaning "high priority" — they are separate concepts.
  let oldestTasks: { particulars: string; responsible: string; company: string; days_open: string; actual_priority: string }[] = []
  try {
    oldestTasks = await query<{ particulars: string; responsible: string; company: string; days_open: string; actual_priority: string }>(`
      SELECT particulars, responsible, company,
        GREATEST(0, EXTRACT(DAY FROM NOW() - created_at))::int::text AS days_open,
        priority AS actual_priority
      FROM tasks
      WHERE status NOT IN ('resolved','expired')
        AND (hk_comment IS NULL OR TRIM(hk_comment) = '')
      ORDER BY created_at ASC
      LIMIT 8`)
  } catch { /**/ }

  // ── 6. Per-person HIGH and CRITICAL priority task count (accurate data) ──
  let highPriorityByPerson: { responsible: string; critical_count: string; high_count: string; medium_count: string }[] = []
  try {
    highPriorityByPerson = await query<{ responsible: string; critical_count: string; high_count: string; medium_count: string }>(`
      SELECT responsible,
        COUNT(CASE WHEN priority='critical' THEN 1 END)::text AS critical_count,
        COUNT(CASE WHEN priority='high'     THEN 1 END)::text AS high_count,
        COUNT(CASE WHEN priority='medium'   THEN 1 END)::text AS medium_count
      FROM tasks
      WHERE status NOT IN ('resolved','expired')
        AND responsible IS NOT NULL AND responsible != ''
      GROUP BY responsible
      HAVING COUNT(CASE WHEN priority IN ('critical','high') THEN 1 END) > 0
      ORDER BY (COUNT(CASE WHEN priority='critical' THEN 1 END) + COUNT(CASE WHEN priority='high' THEN 1 END)) DESC
      LIMIT 10`)
  } catch { /**/ }

  // ── 7. Workload distribution ─────────────────────────────────────────────
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

  // ── 8. Overview snapshot ─────────────────────────────────────────────────
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

  // ── 9. Leave pending ─────────────────────────────────────────────────────
  let leavePending = 0
  try {
    const rows = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status NOT IN ('approved','rejected')`)
    leavePending = parseInt(rows[0]?.count ?? '0', 10)
  } catch { /**/ }

  // ── Build context ─────────────────────────────────────────────────────────
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const context = `
Today: ${today}
Organisation: Pabari Group

BACKLOG OVERVIEW
Total open: ${overview?.total ?? '?'} | Action required: ${overview?.action_req ?? '?'} | Needs HK comment: ${overview?.hk_queue ?? '?'}

TASK VELOCITY (this week vs last week)
Created: ${velocity?.created_this_week ?? '?'} this week / ${velocity?.created_last_week ?? '?'} last week
Resolved: ${velocity?.resolved_this_week ?? '?'} this week / ${velocity?.resolved_last_week ?? '?'} last week

DEADLINE RISK (tasks due within 7 days, per person)
${deadlineRisk.length ? deadlineRisk.map(r => `${r.responsible}: ${r.due_this_week} tasks due, ${r.blocked} blocked on approval`).join('\n') : 'No tasks have due dates set this week'}

APPROVAL BOTTLENECK BY SECTION (action-required or awaiting approval)
${approvalBottleneck.length ? approvalBottleneck.map(r => `${r.section}: ${r.total} pending (${r.added_this_week} added this week)`).join('\n') : 'None'}

OLDEST UNRESOLVED TASKS BY AGE (these are sorted by how long open, NOT by priority — see actual_priority field)
${oldestTasks.map(r => `"${r.particulars.slice(0, 55)}" — owner: ${r.responsible}, company: ${r.company}, open: ${r.days_open} days, actual priority: ${r.actual_priority}`).join('\n')}

ACTUAL HIGH/CRITICAL PRIORITY TASKS PER PERSON (only people with at least 1 high or critical task)
${highPriorityByPerson.length ? highPriorityByPerson.map(r => `${r.responsible}: ${r.critical_count} critical, ${r.high_count} high, ${r.medium_count} medium priority open tasks`).join('\n') : 'No one currently has high or critical priority tasks'}

TEAM WORKLOAD (total open tasks per person)
${workload.map(r => `${r.responsible}: ${r.open} open`).join(' | ')}

PCR PROCESSING TIME (submission to disbursement)
This month avg: ${pcrProcessing?.this_month ?? 'N/A'} days | Last month avg: ${pcrProcessing?.last_month ?? 'N/A'} days

LEAVE REQUESTS PENDING APPROVAL: ${leavePending}
`.trim()

  const systemPrompt = `You are Pabari Intelligence — an executive forecasting system for Pabari Group.
You receive structured operational data from the ERP database and produce specific, data-driven forecast statements.

ACCURACY RULES (non-negotiable):
- Every statement MUST contain at least one specific number, name, or date from the data — no generic statements allowed.
- NEVER call a task "high risk" unless its actual_priority field says "high" or "critical". Age alone ≠ high priority.
- NEVER say "multiple" unless count ≥ 2 from the data.
- NEVER invent numbers not in the data.
- If a data section is empty or N/A, skip it and use a different data point.

SPECIFICITY RULES:
- Use real task names, real people's names, real counts, real company names from the data.
- Bad: "Velocity will remain steady." Good: "With only 2 tasks resolved this week vs 8 created, the backlog will grow by at least 6 tasks."
- Bad: "Workload imbalance will persist." Good: "Yared carries 43 open tasks — the heaviest load on the team — while the backlog shows no sign of reducing."
- Bad: "Aging tasks will continue unresolved." Good: "The Ministry of Environment letter has been open 95 days with no HK comment — at current pace it will exceed 100 days this week."
- Always name the specific task, person, or company when the data provides it.

OUTPUT FORMAT:
- Return exactly 5 forecast statements
- Each on its own line — no numbers, bullets, or markdown
- Each between 20 and 35 words
- Every statement is forward-looking: what WILL happen, what IS AT RISK, what IS TRENDING
- Tone: precise executive intelligence briefing
- Never start with "I", "We", or "The system"`

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 400,
      temperature: 0.2,
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
