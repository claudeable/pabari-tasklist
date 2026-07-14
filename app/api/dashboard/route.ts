import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'
const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const SURESH_EMAIL  = 'ssuresh@kwale-group.com'
const AHMAD_EMAIL   = 'ahmad@usm.co.ke'
const SABINA_EMAIL  = 'smutua@kwale-group.com'

function cnt(rows: { count: string }[]) {
  return parseInt(rows[0]?.count ?? '0', 10)
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today     = new Date().toISOString().slice(0, 10)
  const firstName = (user.name?.split(' ')[0] ?? '').toLowerCase()
  const uid       = parseInt(String(user.id ?? ''), 10) || 0
  const isHR      = user.department === 'HR' || user.role === 'admin'
  const isAdmin   = user.role === 'admin'

  // ── Tasks ───────────────────────────────────────────────────────────────────
  let myTasks       = 0
  let overdueTasks  = 0
  let dueToday      = 0
  let completedToday = 0
  let highPriorityTasks: { id: string; description: string; company: string; due_date: string }[] = []

  try {
    const [mine, overdue, todayDue, completedT, highP] = await Promise.all([
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tasks
         WHERE status NOT IN ('completed','cancelled')
         AND LOWER(assigned_to) = LOWER($1)`,
        [user.name]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tasks
         WHERE status NOT IN ('completed','cancelled')
         AND due_date < $1 AND due_date != ''
         AND LOWER(assigned_to) = LOWER($2)`,
        [today, user.name]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tasks
         WHERE status NOT IN ('completed','cancelled')
         AND due_date = $1
         AND LOWER(assigned_to) = LOWER($2)`,
        [today, user.name]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM tasks
         WHERE status = 'completed'
         AND DATE(updated_at) = $1
         AND LOWER(assigned_to) = LOWER($2)`,
        [today, user.name]
      ),
      query<{ id: string; description: string; company: string; due_date: string }>(
        `SELECT id, description, company, due_date FROM tasks
         WHERE status NOT IN ('completed','cancelled')
         AND priority IN ('high','critical')
         AND LOWER(assigned_to) = LOWER($1)
         ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 END, due_date
         LIMIT 5`,
        [user.name]
      ),
    ])
    myTasks        = cnt(mine)
    overdueTasks   = cnt(overdue)
    dueToday       = cnt(todayDue)
    completedToday = cnt(completedT)
    highPriorityTasks = highP
  } catch { /* tasks table may not exist */ }

  // ── Approvals ───────────────────────────────────────────────────────────────
  let approvalsWaiting = 0
  let approvalItems: { label: string; href: string; type: string }[] = []

  try {
    let leave = 0
    let pcr   = 0

    if (isHR) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status='pending_hr'`)
      leave += cnt(r)
    }
    if (isAdmin) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status='pending_hk'`)
      leave += cnt(r)
    }
    if (user.email?.toLowerCase() === HOS_EMAIL) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hos' AND form_type='general'`)
      pcr += cnt(r)
    }
    if (user.email?.toLowerCase() === SURESH_EMAIL) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hos' AND form_type='kiscol'`)
      pcr += cnt(r)
    }
    if (user.email?.toLowerCase() === AHMAD_EMAIL) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hod' AND form_type='kiscol'`)
      pcr += cnt(r)
    }
    if (user.email?.toLowerCase() === FINANCE_EMAIL) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_finance' AND form_type='general'`)
      pcr += cnt(r)
    }
    if (user.email?.toLowerCase() === SABINA_EMAIL) {
      const r = await query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hod' AND form_type='general' AND LOWER(SPLIT_PART(hod_name,' ',1))='paul'`)
      pcr += cnt(r)
    }
    if (uid > 0 || firstName) {
      const r = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hod' AND form_type='general' AND (hod_id=$1 OR LOWER(SPLIT_PART(hod_name,' ',1))=LOWER($2))`,
        [uid, firstName]
      )
      pcr += cnt(r)
    }

    approvalsWaiting = leave + pcr
    if (leave > 0) approvalItems.push({ label: `${leave} leave request${leave > 1 ? 's' : ''} to review`, href: '/forms/leave', type: 'leave' })
    if (pcr > 0)   approvalItems.push({ label: `${pcr} petty cash request${pcr > 1 ? 's' : ''} to approve`, href: '/forms/petty-cash', type: 'pcr' })
  } catch { /* forms tables may not exist */ }

  // ── Recent activity (last 8 entries) ────────────────────────────────────────
  let recentActivity: { user_name: string; action: string; details: string; created_at: string }[] = []
  try {
    recentActivity = await query<{ user_name: string; action: string; details: string; created_at: string }>(
      `SELECT user_name, action, details, created_at FROM activity_log ORDER BY created_at DESC LIMIT 8`
    )
  } catch { /* activity_log may not exist */ }

  // ── Finance stats (admin/harshil/benson) ─────────────────────────────────────
  let financeStats: { draft: number; sent: number; overdue: number } | null = null
  const canSeeFinance = isAdmin || firstName === 'harshil' || firstName === 'benson'
  if (canSeeFinance) {
    try {
      const rows = await query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count FROM invoices GROUP BY status`
      )
      const byStatus: Record<string, number> = {}
      rows.forEach(r => { byStatus[r.status] = parseInt(r.count, 10) })
      financeStats = {
        draft:   (byStatus['draft'] ?? 0),
        sent:    (byStatus['sent'] ?? 0),
        overdue: (byStatus['overdue'] ?? 0),
      }
    } catch { /* invoices table may not exist */ }
  }

  return NextResponse.json({
    myTasks,
    overdueTasks,
    dueToday,
    completedToday,
    approvalsWaiting,
    approvalItems,
    highPriorityTasks,
    recentActivity,
    financeStats,
    today,
  })
}
