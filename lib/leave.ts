import { query, queryOne, execute } from './database'
import type { LeaveType, LeaveStatus, LeaveRequest } from './leaveTypes'
export { LEAVE_COMPANIES, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, ANNUAL_LEAVE_LIMIT } from './leaveTypes'
export type { LeaveType, LeaveStatus, LeaveRequest } from './leaveTypes'

let initPromise: Promise<void> | null = null

function ensureTable(): Promise<void> {
  if (!initPromise) {
    initPromise = _initTable().catch(err => {
      initPromise = null
      throw err
    })
  }
  return initPromise
}

async function _initTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id SERIAL PRIMARY KEY,
      employee_id INTEGER,
      employee_name TEXT NOT NULL DEFAULT '',
      employee_no TEXT DEFAULT '',
      department TEXT DEFAULT '',
      job_title TEXT DEFAULT '',
      date_of_employment TEXT DEFAULT '',
      telephone TEXT DEFAULT '',
      company TEXT NOT NULL DEFAULT '',
      leave_type TEXT NOT NULL DEFAULT 'annual',
      date_from DATE NOT NULL DEFAULT CURRENT_DATE,
      date_to DATE NOT NULL DEFAULT CURRENT_DATE,
      days_requested INTEGER NOT NULL DEFAULT 0,
      reason TEXT DEFAULT '',
      cover_person TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_hr',
      hr_notes TEXT DEFAULT '',
      hr_reviewed_by INTEGER,
      hr_reviewed_at TIMESTAMPTZ,
      hk_notes TEXT DEFAULT '',
      hk_approved_by INTEGER,
      hk_approved_at TIMESTAMPTZ,
      rejection_reason TEXT DEFAULT '',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      year INTEGER NOT NULL DEFAULT 0
    )
  `)
  await execute(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS year        INTEGER NOT NULL DEFAULT 0`)
  await execute(`ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS employee_id INTEGER`)
}

function dateStr(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  return String(val).split('T')[0]
}

function rowToLeave(row: Record<string, unknown>): LeaveRequest {
  return {
    id: Number(row.id),
    employee_id: row.employee_id ? Number(row.employee_id) : null,
    employee_name: String(row.employee_name || ''),
    employee_no: String(row.employee_no || ''),
    department: String(row.department || ''),
    job_title: String(row.job_title || ''),
    date_of_employment: String(row.date_of_employment || ''),
    telephone: String(row.telephone || ''),
    company: String(row.company || ''),
    leave_type: row.leave_type as LeaveType,
    date_from: dateStr(row.date_from),
    date_to: dateStr(row.date_to),
    days_requested: Number(row.days_requested),
    reason: String(row.reason || ''),
    cover_person: String(row.cover_person || ''),
    status: row.status as LeaveStatus,
    hr_notes: String(row.hr_notes || ''),
    hr_reviewed_by: row.hr_reviewed_by ? Number(row.hr_reviewed_by) : null,
    hr_reviewed_at: row.hr_reviewed_at ? String(row.hr_reviewed_at) : null,
    hk_notes: String(row.hk_notes || ''),
    hk_approved_by: row.hk_approved_by ? Number(row.hk_approved_by) : null,
    hk_approved_at: row.hk_approved_at ? String(row.hk_approved_at) : null,
    rejection_reason: String(row.rejection_reason || ''),
    submitted_at: String(row.submitted_at || ''),
    year: Number(row.year),
  }
}

export async function getAllLeaveRequests(): Promise<LeaveRequest[]> {
  await ensureTable()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM leave_requests ORDER BY submitted_at DESC'
  )
  return rows.map(rowToLeave)
}

export async function getMyLeaveRequests(employee_name: string, employee_id?: number): Promise<LeaveRequest[]> {
  await ensureTable()
  const safeId = (employee_id != null && !isNaN(employee_id)) ? employee_id : null
  console.log('[getMyLeaveRequests] name=%s id=%s', employee_name, safeId)
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM leave_requests
     WHERE LOWER(employee_name) = LOWER($1)
        OR ($2::integer IS NOT NULL AND employee_id = $2::integer)
     ORDER BY submitted_at DESC`,
    [employee_name, safeId]
  )
  console.log('[getMyLeaveRequests] found %d rows', rows.length)
  return rows.map(rowToLeave)
}

export async function getLeaveBalance(employee_name: string, year: number): Promise<number> {
  await ensureTable()
  const rows = await query<{ total: string }>(
    `SELECT COALESCE(SUM(days_requested), 0) as total
     FROM leave_requests
     WHERE LOWER(employee_name) = LOWER($1) AND leave_type = 'annual' AND year = $2
     AND status NOT IN ('rejected')`,
    [employee_name, year]
  )
  return Number(rows[0]?.total || 0)
}

export async function createLeaveRequest(data: {
  employee_id: number
  employee_name: string
  employee_no: string
  department: string
  job_title: string
  date_of_employment: string
  telephone: string
  company: string
  leave_type: LeaveType
  date_from: string
  date_to: string
  days_requested: number
  reason: string
  cover_person: string
  year: number
}): Promise<LeaveRequest> {
  await ensureTable()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO leave_requests (
      employee_id, employee_name, employee_no, department, job_title,
      date_of_employment, telephone, company, leave_type, date_from, date_to,
      days_requested, reason, cover_person, year
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *`,
    [
      data.employee_id, data.employee_name, data.employee_no, data.department,
      data.job_title, data.date_of_employment, data.telephone, data.company,
      data.leave_type, data.date_from, data.date_to, data.days_requested,
      data.reason, data.cover_person, data.year,
    ]
  )
  if (!row) throw new Error('Failed to create leave request')
  return rowToLeave(row)
}

export async function approveByHR(id: number, reviewer_id: number, notes: string): Promise<void> {
  await execute(
    `UPDATE leave_requests SET status='pending_hk', hr_notes=$1, hr_reviewed_by=$2, hr_reviewed_at=NOW() WHERE id=$3`,
    [notes, reviewer_id, id]
  )
}

export async function approveByHK(id: number, approver_id: number, notes: string): Promise<void> {
  await execute(
    `UPDATE leave_requests SET status='approved', hk_notes=$1, hk_approved_by=$2, hk_approved_at=NOW() WHERE id=$3`,
    [notes, approver_id, id]
  )
}

export async function rejectLeave(id: number, reason: string): Promise<void> {
  await execute(
    `UPDATE leave_requests SET status='rejected', rejection_reason=$1 WHERE id=$2`,
    [reason, id]
  )
}

export async function deleteLeaveRequest(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM leave_requests WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}
