import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

export interface NotifItem {
  id:     string
  type:   'approval' | 'task_assigned' | 'overdue' | 'activity'
  title:  string
  detail: string
  href:   string
  time:   string
  icon:   string
}

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'
const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const SURESH_EMAIL  = 'ssuresh@kwale-group.com'
const AHMAD_EMAIL   = 'ahmad@usm.co.ke'
const SABINA_EMAIL  = 'smutua@kwale-group.com'
const YALELET_EMAIL = 'yaynalem@usm.co.ke'

const ACTIVITY_MAP: Record<string, { label: string; icon: string }> = {
  task_created:        { label: 'Task created',            icon: '✓'  },
  task_status_changed: { label: 'Task status updated',     icon: '🔄' },
  task_commented:      { label: 'HK comment added',        icon: '💬' },
  task_update_posted:  { label: 'Update posted on task',   icon: '📝' },
  leave_submitted:     { label: 'Leave request submitted', icon: '📅' },
  leave_approved:      { label: 'Leave approved',          icon: '✅' },
  leave_rejected:      { label: 'Leave rejected',          icon: '❌' },
  pcr_submitted:       { label: 'Petty cash submitted',    icon: '💵' },
  pcr_approved:        { label: 'Petty cash approved',     icon: '✅' },
  pcr_rejected:        { label: 'Petty cash rejected',     icon: '❌' },
  doc_uploaded:        { label: 'Document uploaded',       icon: '📁' },
  invoice_created:     { label: 'Invoice / LPO created',  icon: '💳' },
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today     = new Date().toISOString().slice(0, 10)
  const firstName = (user.name?.split(' ')[0] ?? '').toLowerCase()
  const isAdmin   = user.role === 'admin'
  const isHR      = user.department === 'HR' || isAdmin
  const uid       = parseInt(String(user.id ?? ''), 10) || 0
  const email     = user.email?.toLowerCase() ?? ''

  const items: NotifItem[] = []
  const seen = new Set<string>()
  function push(item: NotifItem) {
    if (!seen.has(item.id)) { seen.add(item.id); items.push(item) }
  }

  // ── Pending leave approvals ───────────────────────────────────────────────
  try {
    const statuses = isAdmin ? ['pending_hr', 'pending_hk'] : isHR ? ['pending_hr'] : []
    for (const s of statuses) {
      const rows = await query<{ id: string; employee_name: string; leave_type: string; created_at: string }>(
        `SELECT id::text, employee_name, leave_type, created_at FROM leave_requests WHERE status=$1 ORDER BY created_at DESC LIMIT 5`,
        [s]
      )
      rows.forEach(r => push({
        id: `leave-${r.id}`, type: 'approval', icon: '📅',
        title: `Leave request from ${r.employee_name}`,
        detail: r.leave_type + ' · Awaiting your approval',
        href: '/forms/leave', time: r.created_at,
      }))
    }
  } catch { /* */ }

  // ── Pending petty cash approvals ──────────────────────────────────────────
  try {
    const pcrChecks: { sql: string; params: (string | number)[] }[] = []
    if (email === HOS_EMAIL)     pcrChecks.push({ sql: `status='pending_hos' AND form_type='general'`, params: [] })
    if (email === SURESH_EMAIL)  pcrChecks.push({ sql: `status='pending_hos' AND form_type='kiscol'`, params: [] })
    if (email === AHMAD_EMAIL)   pcrChecks.push({ sql: `status='pending_hod' AND form_type='kiscol'`, params: [] })
    if (email === FINANCE_EMAIL) pcrChecks.push({ sql: `status='pending_finance' AND form_type='general'`, params: [] })
    if (email === SABINA_EMAIL)   pcrChecks.push({ sql: `status='pending_hod' AND form_type='general' AND LOWER(SPLIT_PART(hod_name,' ',1))='paul'`, params: [] })
    if (uid > 0 || firstName)     pcrChecks.push({ sql: `status='pending_hod' AND form_type='general' AND (hod_id=$1 OR LOWER(SPLIT_PART(hod_name,' ',1))=LOWER($2))`, params: [uid, firstName] })
    // Yalelet: approved requests waiting for disbursement
    if (isAdmin || email === YALELET_EMAIL) pcrChecks.push({ sql: `status='approved'`, params: [] })
    for (const c of pcrChecks) {
      const rows = await query<{ id: string; employee_name: string; amount: string; created_at: string }>(
        `SELECT id::text, employee_name, amount::text, created_at FROM petty_cash_requests WHERE ${c.sql} ORDER BY created_at DESC LIMIT 3`,
        c.params
      )
      rows.forEach(r => {
        const needsDisburse = c.sql.includes(`status='approved'`)
        push({
          id: `pcr-${r.id}`, type: 'approval', icon: needsDisburse ? '💸' : '💵',
          title: needsDisburse ? `Disburse cash to ${r.employee_name}` : `Petty cash: ${r.employee_name}`,
          detail: `KES ${Number(r.amount).toLocaleString()} · ${needsDisburse ? 'Approved — ready to send' : 'Awaiting your approval'}`,
          href: '/forms/petty-cash', time: r.created_at,
        })
      })
    }
  } catch { /* */ }

  // ── Disbursed requests waiting for the requester to confirm receipt ───────
  try {
    const rows = await query<{ id: string; employee_name: string; total_amount: string; disbursement_method: string; disbursement_reference: string; disbursed_at: string }>(
      `SELECT id::text, employee_name, total_amount::text, disbursement_method, disbursement_reference, disbursed_at
       FROM petty_cash_requests
       WHERE status='disbursed'
       AND (employee_id=$1 OR LOWER(employee_name)=LOWER($2))
       ORDER BY disbursed_at DESC LIMIT 5`,
      [uid, user.name]
    )
    rows.forEach(r => push({
      id: `pcr-disburse-${r.id}`, type: 'approval', icon: '✅',
      title: `Confirm receipt of KES ${Number(r.total_amount).toLocaleString()}`,
      detail: `Sent via ${r.disbursement_method}${r.disbursement_reference ? ` (${r.disbursement_reference})` : ''} · Tap to confirm`,
      href: '/forms/petty-cash', time: r.disbursed_at,
    }))
  } catch { /* */ }

  // ── Tasks awaiting HOD approval (visible to managers and above) ──────────
  try {
    const isManagerOrAbove = ['manager', 'director', 'admin', 'ceo'].includes(user.role)
    if (isManagerOrAbove) {
      let hodRows: { id: string; particulars: string; company: string; responsible: string; created_at: string }[]
      if (isAdmin || user.role === 'director' || user.role === 'ceo') {
        hodRows = await query<{ id: string; particulars: string; company: string; responsible: string; created_at: string }>(
          `SELECT id::text, particulars, company, responsible, created_at
           FROM tasks WHERE status = 'awaiting-hod-approval'
           ORDER BY created_at DESC LIMIT 10`
        )
      } else {
        hodRows = await query<{ id: string; particulars: string; company: string; responsible: string; created_at: string }>(
          `SELECT t.id::text, t.particulars, t.company, t.responsible, t.created_at
           FROM tasks t
           WHERE t.status = 'awaiting-hod-approval'
           AND EXISTS (
             SELECT 1 FROM users u
             WHERE LOWER(u.name) = LOWER(t.responsible)
             AND LOWER(u.reports_to) = LOWER($1)
           )
           ORDER BY t.created_at DESC LIMIT 10`,
          [email]
        )
      }
      hodRows.forEach(r => push({
        id: `hod-${r.id}`, type: 'approval', icon: '✅',
        title: `Task needs your approval`,
        detail: `${r.responsible} · ${r.particulars.length > 55 ? r.particulars.slice(0, 55) + '…' : r.particulars}`,
        href: '/tasks',
        time: r.created_at,
      }))
    }
  } catch { /* */ }

  // ── My overdue tasks ──────────────────────────────────────────────────────
  try {
    const rows = await query<{ id: string; particulars: string; company: string; due_date: string; created_at: string }>(
      `SELECT id::text, particulars, company, due_date, created_at FROM tasks
       WHERE status NOT IN ('resolved','expired')
       AND due_date IS NOT NULL AND due_date != '' AND due_date < $1
       AND LOWER(responsible) = LOWER($2)
       ORDER BY due_date ASC LIMIT 5`,
      [today, user.name]
    )
    rows.forEach(r => push({
      id: `overdue-${r.id}`, type: 'overdue', icon: '⚠️',
      title: r.particulars.length > 65 ? r.particulars.slice(0, 65) + '…' : r.particulars,
      detail: `${r.company} · Overdue since ${r.due_date}`,
      href: '/tasks', time: r.created_at,
    }))
  } catch { /* */ }

  // ── Recently assigned tasks (last 14 days) ────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const rows = await query<{ id: string; particulars: string; company: string; created_at: string }>(
      `SELECT id::text, particulars, company, created_at FROM tasks
       WHERE LOWER(responsible) = LOWER($1) AND created_at > $2
       ORDER BY created_at DESC LIMIT 8`,
      [user.name, cutoff]
    )
    rows.forEach(r => push({
      id: `task-${r.id}`, type: 'task_assigned', icon: '✓',
      title: r.particulars.length > 65 ? r.particulars.slice(0, 65) + '…' : r.particulars,
      detail: r.company + ' · Assigned to you',
      href: '/tasks', time: r.created_at,
    }))
  } catch { /* */ }

  // ── Recent activity involving this user ───────────────────────────────────
  try {
    const rows = await query<{ id: number; user_name: string; action: string; details: string; created_at: string }>(
      `SELECT id, user_name, action, details, created_at FROM activity_log
       WHERE (LOWER(user_name) = LOWER($1) OR details ILIKE $2)
         AND action NOT IN ('login','logout')
       ORDER BY created_at DESC LIMIT 10`,
      [user.name, `%${user.name}%`]
    )
    rows.forEach(r => {
      const meta = ACTIVITY_MAP[r.action]
      if (!meta) return
      push({
        id: `act-${r.id}`, type: 'activity', icon: meta.icon,
        title: meta.label,
        detail: (r.details ?? '').slice(0, 80),
        href: '/', time: r.created_at,
      })
    })
  } catch { /* */ }

  items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

  return NextResponse.json({ items: items.slice(0, 30) })
}
