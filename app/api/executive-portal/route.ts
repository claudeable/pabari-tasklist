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

  // ── Action-required tasks (priority queue) ──────────────────────────────
  let actionTasks: { id: string; particulars: string; company: string; responsible: string; priority: string }[] = []
  try {
    actionTasks = await query<{ id: string; particulars: string; company: string; responsible: string; priority: string }>(
      `SELECT id::text, particulars, company, responsible, priority FROM tasks
       WHERE status = 'action-required'
       ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END LIMIT 10`
    )
  } catch { /**/ }

  // ── Awaiting HK approval tasks ──────────────────────────────────────────
  let approvalTasks: { id: string; particulars: string; company: string; responsible: string }[] = []
  try {
    approvalTasks = await query<{ id: string; particulars: string; company: string; responsible: string }>(
      `SELECT id::text, particulars, company, responsible FROM tasks
       WHERE status = 'awaiting-hk-approval' LIMIT 5`
    )
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

  // ── Today's activity ────────────────────────────────────────────────────
  let todayActivity: { user_name: string; action: string; details: string; created_at: string }[] = []
  try {
    todayActivity = await query<{ user_name: string; action: string; details: string; created_at: string }>(
      `SELECT user_name, action, details, created_at FROM activity_log
       WHERE created_at >= $1::date ORDER BY created_at DESC LIMIT 30`, [today]
    )
  } catch { /**/ }

  // ── Weekly resolved per person ──────────────────────────────────────────
  let weeklyPerf: { responsible: string; resolved: string; open: string }[] = []
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    weeklyPerf = await query<{ responsible: string; resolved: string; open: string }>(
      `SELECT
         t.responsible,
         COUNT(CASE WHEN t.status='resolved' AND LEFT(t.updated_at::text,10) >= $1 THEN 1 END)::text AS resolved,
         COUNT(CASE WHEN t.status NOT IN ('resolved','expired') THEN 1 END)::text AS open
       FROM tasks t
       WHERE t.responsible IS NOT NULL AND t.responsible != ''
       GROUP BY t.responsible
       HAVING COUNT(*) > 0
       ORDER BY resolved::int DESC, open::int ASC LIMIT 12`, [weekAgo]
    )
  } catch { /**/ }

  // ── Documents ───────────────────────────────────────────────────────────
  let docCount = 0
  try {
    docCount = cnt(await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM documents`))
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
    // Counts
    totalOpen, actionRequired, needsHkComment,
    awaitingApproval, resolvedToday,
    pcrActive, pcrHighValue, leavePending, docCount,
    // Lists
    actionTasks, approvalTasks, pcrItems,
    todayActivity, weeklyPerf, byCompany,
  })
}
