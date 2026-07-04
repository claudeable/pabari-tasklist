import { query, queryOne, execute } from './database'

export type PettyCashStatus = 'pending_hos' | 'pending_hod' | 'pending_finance' | 'approved' | 'rejected'

export const PETTY_CASH_STATUS_LABELS: Record<PettyCashStatus, string> = {
  pending_hos:     'Pending HOS (Krishna)',
  pending_hod:     'Pending HOD Approval',
  pending_finance: 'Pending Finance (Andu)',
  approved:        'Approved',
  rejected:        'Rejected',
}

export interface PettyCashItem {
  description: string
  account_no:  string
  amount:      number
}

export interface PettyCashRequest {
  id:               number
  form_type:        'kiscol' | 'general'
  req_no:           string
  voucher_no:       string
  request_date:     string
  company:          string
  employee_id:      number | null
  employee_name:    string
  employee_id_no:   string
  department:       string
  items:            PettyCashItem[]
  total_amount:     number
  amount_in_words:  string
  delegate_name:    string
  delegate_id_no:   string
  hod_id:           number | null
  hod_name:         string
  status:           PettyCashStatus
  hos_approved_by:  number | null
  hos_approved_at:  string | null
  hod_approved_by:  number | null
  hod_approved_at:  string | null
  finance_approved_by: number | null
  finance_approved_at: string | null
  rejection_reason: string
  submitted_at:     string
  year:             number
}

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS petty_cash_requests (
      id SERIAL PRIMARY KEY,
      form_type TEXT NOT NULL DEFAULT 'general',
      req_no TEXT DEFAULT '',
      voucher_no TEXT DEFAULT '',
      request_date DATE NOT NULL,
      company TEXT NOT NULL,
      employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      employee_name TEXT NOT NULL,
      employee_id_no TEXT DEFAULT '',
      department TEXT NOT NULL,
      items JSONB NOT NULL DEFAULT '[]',
      total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
      amount_in_words TEXT DEFAULT '',
      delegate_name TEXT DEFAULT '',
      delegate_id_no TEXT DEFAULT '',
      hod_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      hod_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending_hos',
      hos_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      hos_approved_at TIMESTAMPTZ,
      hod_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      hod_approved_at TIMESTAMPTZ,
      finance_approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      finance_approved_at TIMESTAMPTZ,
      rejection_reason TEXT DEFAULT '',
      submitted_at TIMESTAMPTZ DEFAULT NOW(),
      year INTEGER NOT NULL
    )
  `)
  tableReady = true
}

function parseItems(val: unknown): PettyCashItem[] {
  if (!val) return []
  if (Array.isArray(val)) return val as PettyCashItem[]
  try { return JSON.parse(String(val)) } catch { return [] }
}

function dateStr(val: unknown): string {
  if (!val) return ''
  if (val instanceof Date) return val.toISOString().split('T')[0]
  return String(val).split('T')[0]
}

function rowToPettyCash(row: Record<string, unknown>): PettyCashRequest {
  return {
    id:               Number(row.id),
    form_type:        (row.form_type as 'kiscol' | 'general') || 'general',
    req_no:           String(row.req_no || ''),
    voucher_no:       String(row.voucher_no || ''),
    request_date:     dateStr(row.request_date),
    company:          String(row.company || ''),
    employee_id:      row.employee_id ? Number(row.employee_id) : null,
    employee_name:    String(row.employee_name || ''),
    employee_id_no:   String(row.employee_id_no || ''),
    department:       String(row.department || ''),
    items:            parseItems(row.items),
    total_amount:     Number(row.total_amount || 0),
    amount_in_words:  String(row.amount_in_words || ''),
    delegate_name:    String(row.delegate_name || ''),
    delegate_id_no:   String(row.delegate_id_no || ''),
    hod_id:           row.hod_id ? Number(row.hod_id) : null,
    hod_name:         String(row.hod_name || ''),
    status:           row.status as PettyCashStatus,
    hos_approved_by:  row.hos_approved_by ? Number(row.hos_approved_by) : null,
    hos_approved_at:  row.hos_approved_at ? String(row.hos_approved_at) : null,
    hod_approved_by:  row.hod_approved_by ? Number(row.hod_approved_by) : null,
    hod_approved_at:  row.hod_approved_at ? String(row.hod_approved_at) : null,
    finance_approved_by: row.finance_approved_by ? Number(row.finance_approved_by) : null,
    finance_approved_at: row.finance_approved_at ? String(row.finance_approved_at) : null,
    rejection_reason: String(row.rejection_reason || ''),
    submitted_at:     String(row.submitted_at || ''),
    year:             Number(row.year),
  }
}

export async function getAllPettyCashRequests(): Promise<PettyCashRequest[]> {
  await ensureTable()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM petty_cash_requests ORDER BY submitted_at DESC'
  )
  return rows.map(rowToPettyCash)
}

export async function getMyPettyCashRequests(employee_id: number): Promise<PettyCashRequest[]> {
  await ensureTable()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM petty_cash_requests WHERE employee_id = $1 ORDER BY submitted_at DESC',
    [employee_id]
  )
  return rows.map(rowToPettyCash)
}

export async function createPettyCashRequest(data: {
  form_type:      'kiscol' | 'general'
  request_date:   string
  company:        string
  employee_id:    number
  employee_name:  string
  employee_id_no: string
  department:     string
  items:          PettyCashItem[]
  total_amount:   number
  amount_in_words: string
  delegate_name:  string
  delegate_id_no: string
  hod_id:         number | null
  hod_name:       string
  year:           number
}): Promise<PettyCashRequest> {
  await ensureTable()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO petty_cash_requests (
      form_type, request_date, company, employee_id, employee_name, employee_id_no,
      department, items, total_amount, amount_in_words, delegate_name, delegate_id_no,
      hod_id, hod_name, year
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING *`,
    [
      data.form_type, data.request_date, data.company, data.employee_id, data.employee_name,
      data.employee_id_no, data.department, JSON.stringify(data.items),
      data.total_amount, data.amount_in_words, data.delegate_name, data.delegate_id_no,
      data.hod_id, data.hod_name, data.year,
    ]
  )
  if (!row) throw new Error('Failed to create petty cash request')
  const req_no = `PCR-${data.year}-${String(row.id).padStart(4, '0')}`
  await execute('UPDATE petty_cash_requests SET req_no=$1 WHERE id=$2', [req_no, row.id])
  row.req_no = req_no
  return rowToPettyCash(row)
}

export async function approveHOS(id: number, approver_id: number): Promise<void> {
  await execute(
    `UPDATE petty_cash_requests SET status='pending_hod', hos_approved_by=$1, hos_approved_at=NOW() WHERE id=$2`,
    [approver_id, id]
  )
}

export async function approveHOD(id: number, approver_id: number): Promise<void> {
  await execute(
    `UPDATE petty_cash_requests SET status='pending_finance', hod_approved_by=$1, hod_approved_at=NOW() WHERE id=$2`,
    [approver_id, id]
  )
}

export async function approveHODFinal(id: number, approver_id: number): Promise<void> {
  // Used for KISCOL: Ahmad's approval goes directly to 'approved'
  await execute(
    `UPDATE petty_cash_requests SET status='approved', hod_approved_by=$1, hod_approved_at=NOW() WHERE id=$2`,
    [approver_id, id]
  )
}

export async function approveFinance(id: number, approver_id: number): Promise<void> {
  await execute(
    `UPDATE petty_cash_requests SET status='approved', finance_approved_by=$1, finance_approved_at=NOW() WHERE id=$2`,
    [approver_id, id]
  )
}

export async function rejectPettyCash(id: number, reason: string): Promise<void> {
  await execute(
    `UPDATE petty_cash_requests SET status='rejected', rejection_reason=$1 WHERE id=$2`,
    [reason, id]
  )
}
