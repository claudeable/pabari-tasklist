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
      `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired')
       AND (hk_comment IS NULL OR TRIM(hk_comment) = '')`
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

  return NextResponse.json({
    today,
    totalOpen, actionRequired, needsHkComment,
    awaitingApproval, resolvedToday,
    oldestDays, avgWaitDays,
    pcrActive, pcrHighValue, leavePending, docCount,
    dnTotal, dnThisWeek, dnCancelled,
    actionTasks, approvalTasks, pcrItems,
    activityFeed, workload, byCompany,
  })
}
