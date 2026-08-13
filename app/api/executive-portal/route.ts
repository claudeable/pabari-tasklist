import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

function cnt(rows: { count: string }[]) {
  return parseInt(rows[0]?.count ?? '0', 10)
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date().toISOString().slice(0, 10)

  // ── Task counts ─────────────────────────────────────────────────────────
  let totalOpen = 0, actionRequired = 0, needsHkComment = 0,
      awaitingApproval = 0, resolvedToday = 0

  try {
    totalOpen = cnt(await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired')`
    ))
  } catch { /**/ }

  try {
    actionRequired = cnt(await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status = 'action-required'`
    ))
  } catch { /**/ }

  try {
    needsHkComment = cnt(await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks
       WHERE status NOT IN ('resolved','expired','archived')
         AND (hk_comment IS NULL OR TRIM(hk_comment) = '')
         AND (priority IN ('high','critical') OR status = 'awaiting-hk-approval')`
    ))
  } catch { /**/ }

  try {
    awaitingApproval = cnt(await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status = 'awaiting-hk-approval'`
    ))
  } catch { /**/ }

  try {
    resolvedToday = cnt(await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status = 'resolved'
       AND LEFT(updated_at::text, 10) = $1`, [today]
    ))
  } catch { /**/ }

  // ── Action-required tasks — with age ───────────────────────────────────
  let actionTasks: {
    id: string; particulars: string; company: string
    responsible: string; priority: string; created_at: string; days_waiting: string
  }[] = []
  try {
    actionTasks = await query<{
      id: string; particulars: string; company: string
      responsible: string; priority: string; created_at: string; days_waiting: string
    }>(
      `SELECT id::text, particulars, company, responsible, priority,
              created_at::text,
              GREATEST(0, EXTRACT(DAY FROM NOW() - created_at))::int::text AS days_waiting
       FROM tasks WHERE status = 'action-required'
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
                created_at ASC
       LIMIT 15`
    )
  } catch { /**/ }

  // ── Awaiting HK approval — with age ────────────────────────────────────
  let approvalTasks: {
    id: string; particulars: string; company: string
    responsible: string; days_waiting: string
  }[] = []
  try {
    approvalTasks = await query<{
      id: string; particulars: string; company: string
      responsible: string; days_waiting: string
    }>(
      `SELECT id::text, particulars, company, responsible,
              GREATEST(0, EXTRACT(DAY FROM NOW() - created_at))::int::text AS days_waiting
       FROM tasks WHERE status = 'awaiting-hk-approval'
       ORDER BY created_at ASC LIMIT 8`
    )
  } catch { /**/ }

  // ── Oldest open task ────────────────────────────────────────────────────
  let oldestDays = 0
  try {
    const oldest = await query<{ days: string }>(
      `SELECT GREATEST(0, EXTRACT(DAY FROM NOW() - created_at))::int::text AS days
       FROM tasks WHERE status NOT IN ('resolved','expired')
       ORDER BY created_at ASC LIMIT 1`
    )
    oldestDays = parseInt(oldest[0]?.days ?? '0', 10)
  } catch { /**/ }

  // ── Avg wait days for action-required ──────────────────────────────────
  let avgWaitDays = 0
  try {
    const avgRow = await query<{ avg: string }>(
      `SELECT ROUND(AVG(EXTRACT(DAY FROM NOW() - created_at)))::int::text AS avg
       FROM tasks WHERE status = 'action-required'`
    )
    avgWaitDays = parseInt(avgRow[0]?.avg ?? '0', 10)
  } catch { /**/ }

  // ── PCR active ──────────────────────────────────────────────────────────
  let pcrActive = 0, pcrHighValue = 0
  let pcrItems: { req_no: string; employee_name: string; company: string; total_amount: string; status: string }[] = []
  try {
    const pcrs = await query<{ req_no: string; employee_name: string; company: string; total_amount: string; status: string }>(
      `SELECT req_no, employee_name, company, total_amount::text, status
       FROM petty_cash_requests WHERE status NOT IN ('received','rejected')
       ORDER BY total_amount::numeric DESC LIMIT 10`
    )
    pcrItems = pcrs
    pcrActive = pcrs.length
    pcrHighValue = pcrs.filter(r => Number(r.total_amount) >= 100000).length
  } catch { /**/ }

  // ── Leave pending ───────────────────────────────────────────────────────
  let leavePending = 0
  try {
    leavePending = cnt(await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM leave_requests WHERE status NOT IN ('approved','rejected')`
    ))
  } catch { /**/ }

  // ── Full activity history ────────────────────────────────────────────────
  let activityFeed: { user_name: string; action: string; details: string; created_at: string }[] = []
  try {
    activityFeed = await query<{ user_name: string; action: string; details: string; created_at: string }>(
      `SELECT user_name, action, details, created_at FROM activity_log
       ORDER BY created_at DESC LIMIT 100`
    )
  } catch { /**/ }

  // ── Workload per person (all open, not just this week) ──────────────────
  let workload: { responsible: string; open: string; resolved_week: string }[] = []
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    workload = await query<{ responsible: string; open: string; resolved_week: string }>(
      `SELECT
         responsible,
         COUNT(CASE WHEN status NOT IN ('resolved','expired') THEN 1 END)::text AS open,
         COUNT(CASE WHEN status='resolved' AND LEFT(updated_at::text,10) >= $1 THEN 1 END)::text AS resolved_week
       FROM tasks
       WHERE responsible IS NOT NULL AND responsible != ''
       GROUP BY responsible
       HAVING COUNT(CASE WHEN status NOT IN ('resolved','expired') THEN 1 END) > 0
       ORDER BY open::int DESC LIMIT 12`, [weekAgo]
    )
  } catch { /**/ }

  // ── Documents ───────────────────────────────────────────────────────────
  let docCount = 0
  try {
    docCount = cnt(await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM documents`))
  } catch { /**/ }

  // ── Delivery notes ───────────────────────────────────────────────────────
  let dnTotal = 0, dnThisWeek = 0, dnCancelled = 0
  try {
    const rows = await query<{ total: string; this_week: string; cancelled: string }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::text AS this_week,
        COUNT(CASE WHEN status='cancelled' THEN 1 END)::text AS cancelled
      FROM delivery_notes
    `)
    dnTotal     = parseInt(rows[0]?.total     ?? '0', 10)
    dnThisWeek  = parseInt(rows[0]?.this_week ?? '0', 10)
    dnCancelled = parseInt(rows[0]?.cancelled ?? '0', 10)
  } catch { /**/ }

  // ── Legal review tasks ──────────────────────────────────────────────────
  let legalReviewTasks: { id: string; particulars: string; company: string; responsible: string; days_waiting: string }[] = []
  try {
    legalReviewTasks = await query<{ id: string; particulars: string; company: string; responsible: string; days_waiting: string }>(
      `SELECT id::text, particulars, company, responsible,
              GREATEST(0, EXTRACT(DAY FROM NOW() - created_at))::int::text AS days_waiting
       FROM tasks WHERE legal_review = true AND status NOT IN ('resolved','expired','archived')
       ORDER BY created_at ASC LIMIT 20`
    )
  } catch { /**/ }

  // ── By-company breakdown ────────────────────────────────────────────────
  let byCompany: { company: string; total: string; action_req: string }[] = []
  try {
    byCompany = await query<{ company: string; total: string; action_req: string }>(
      `SELECT company,
              COUNT(*)::text AS total,
              COUNT(CASE WHEN status='action-required' THEN 1 END)::text AS action_req
       FROM tasks WHERE status NOT IN ('resolved','expired')
       GROUP BY company ORDER BY total::int DESC LIMIT 15`
    )
  } catch { /**/ }

  // ── HK Attention tasks (escalated + legacy awaiting-hk-approval) ─────────
  let hkAttentionTasks: {
    id: string; particulars: string; company: string; section: string
    responsible: string; status: string; priority: string
    hk_escalation_type: string; hk_escalation_note: string; hk_escalation_by: string
    latest_update: string | null; days_waiting: string
  }[] = []
  try {
    hkAttentionTasks = await query<{
      id: string; particulars: string; company: string; section: string
      responsible: string; status: string; priority: string
      hk_escalation_type: string; hk_escalation_note: string; hk_escalation_by: string
      latest_update: string | null; days_waiting: string
    }>(`
      SELECT
        t.id::text,
        t.particulars,
        t.company,
        t.section,
        t.responsible,
        t.status,
        t.priority,
        COALESCE(t.hk_escalation_type,'none') AS hk_escalation_type,
        COALESCE(t.hk_escalation_note,'')     AS hk_escalation_note,
        COALESCE(t.hk_escalation_by,'')       AS hk_escalation_by,
        GREATEST(0, EXTRACT(DAY FROM NOW() - t.updated_at))::int::text AS days_waiting,
        (SELECT text FROM task_updates WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1) AS latest_update
      FROM tasks t
      WHERE (
        (t.hk_escalation_type IS NOT NULL AND t.hk_escalation_type != 'none')
        OR t.status = 'awaiting-hk-approval'
      )
      AND t.status NOT IN ('resolved','expired','archived')
      ORDER BY
        CASE COALESCE(t.hk_escalation_type,'none')
          WHEN 'decision' THEN 0 WHEN 'action' THEN 1
          WHEN 'guidance' THEN 2 WHEN 'info'   THEN 3 ELSE 4
        END,
        CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
        t.updated_at DESC
      LIMIT 10
    `)
  } catch { /**/ }

  // ── Three metric card counts ─────────────────────────────────────────────
  let needsDecision = 0, awaitingInput = 0, forAwareness = 0
  try {
    const counts = await query<{ needs_decision: string; awaiting_input: string; for_awareness: string }>(`
      SELECT
        COUNT(CASE WHEN hk_escalation_type IN ('decision','action')
                     OR (status='awaiting-hk-approval' AND (hk_escalation_type IS NULL OR hk_escalation_type='none'))
                   THEN 1 END)::text AS needs_decision,
        COUNT(CASE WHEN hk_escalation_type = 'guidance' THEN 1 END)::text AS awaiting_input,
        COUNT(CASE WHEN hk_escalation_type = 'info' THEN 1 END)::text AS for_awareness
      FROM tasks
      WHERE status NOT IN ('resolved','expired','archived')
    `)
    needsDecision = parseInt(counts[0]?.needs_decision ?? '0', 10)
    awaitingInput = parseInt(counts[0]?.awaiting_input ?? '0', 10)
    forAwareness  = parseInt(counts[0]?.for_awareness ?? '0', 10)
  } catch { /**/ }

  // ── Weekly stats for "Your Week" section ─────────────────────────────────
  let resolvedThisWeek = 0, escalatedThisWeek = 0, pendingCount = 0, longRunningCount = 0
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const stats = await query<{
      resolved_this_week: string; escalated_this_week: string
      pending_count: string; long_running_count: string
    }>(`
      SELECT
        COUNT(CASE WHEN status='resolved' AND LEFT(updated_at::text,10) >= $1 THEN 1 END)::text AS resolved_this_week,
        COUNT(CASE WHEN hk_escalation_type != 'none' AND LEFT(updated_at::text,10) >= $1 THEN 1 END)::text AS escalated_this_week,
        COUNT(CASE WHEN status NOT IN ('resolved','expired','archived') THEN 1 END)::text AS pending_count,
        COUNT(CASE WHEN status NOT IN ('resolved','expired','archived') AND created_at < NOW() - INTERVAL '30 days' THEN 1 END)::text AS long_running_count
      FROM tasks
    `, [weekAgo])
    resolvedThisWeek  = parseInt(stats[0]?.resolved_this_week  ?? '0', 10)
    escalatedThisWeek = parseInt(stats[0]?.escalated_this_week ?? '0', 10)
    pendingCount      = parseInt(stats[0]?.pending_count       ?? '0', 10)
    longRunningCount  = parseInt(stats[0]?.long_running_count  ?? '0', 10)
  } catch { /**/ }

  return NextResponse.json({
    today,
    totalOpen, actionRequired, needsHkComment,
    awaitingApproval, resolvedToday,
    oldestDays, avgWaitDays,
    pcrActive, pcrHighValue, leavePending, docCount,
    dnTotal, dnThisWeek, dnCancelled,
    actionTasks, approvalTasks, legalReviewTasks, pcrItems,
    activityFeed, workload, byCompany,
    hkAttentionTasks, needsDecision, awaitingInput, forAwareness,
    resolvedThisWeek, escalatedThisWeek, pendingCount, longRunningCount,
  })
}
