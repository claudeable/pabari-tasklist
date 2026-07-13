import { query, queryOne, execute } from './database'
import type { Invoice, DeliveryNote, InvoiceItem, InvoiceStatus, DocType } from '@/types'

let tablesReady = false

async function ensureFinanceTables() {
  if (tablesReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS invoices (
      id               SERIAL PRIMARY KEY,
      doc_no           TEXT NOT NULL DEFAULT '',
      type             TEXT NOT NULL DEFAULT 'invoice',
      status           TEXT NOT NULL DEFAULT 'draft',
      issuing_company  TEXT NOT NULL DEFAULT '',
      client_name      TEXT NOT NULL DEFAULT '',
      client_address   TEXT NOT NULL DEFAULT '',
      client_email     TEXT NOT NULL DEFAULT '',
      issue_date       DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date         DATE,
      validity_date    DATE,
      items            JSONB NOT NULL DEFAULT '[]',
      subtotal         NUMERIC(14,2) NOT NULL DEFAULT 0,
      tax_rate         NUMERIC(5,2) NOT NULL DEFAULT 16,
      tax_amount       NUMERIC(14,2) NOT NULL DEFAULT 0,
      total            NUMERIC(14,2) NOT NULL DEFAULT 0,
      notes            TEXT NOT NULL DEFAULT '',
      terms            TEXT NOT NULL DEFAULT '',
      project_id       INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      created_by       TEXT NOT NULL DEFAULT '',
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      converted_from   INTEGER REFERENCES invoices(id) ON DELETE SET NULL
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS delivery_notes (
      id            SERIAL PRIMARY KEY,
      dn_no         TEXT NOT NULL DEFAULT '',
      invoice_id    INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
      invoice_no    TEXT NOT NULL DEFAULT '',
      project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      delivery_date DATE NOT NULL DEFAULT CURRENT_DATE,
      delivered_to  TEXT NOT NULL DEFAULT '',
      received_by   TEXT NOT NULL DEFAULT '',
      items         JSONB NOT NULL DEFAULT '[]',
      notes         TEXT NOT NULL DEFAULT '',
      created_by    TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  tablesReady = true
}

function parseItems(val: unknown): InvoiceItem[] {
  if (!val) return []
  if (Array.isArray(val)) return val as InvoiceItem[]
  try { return JSON.parse(String(val)) } catch { return [] }
}

function fmtDate(v: unknown): string {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

function rowToInvoice(row: Record<string, unknown>): Invoice {
  return {
    id:              Number(row.id),
    doc_no:          String(row.doc_no || ''),
    type:            (row.type as DocType) || 'invoice',
    status:          (row.status as InvoiceStatus) || 'draft',
    issuing_company: String(row.issuing_company || ''),
    client_name:     String(row.client_name || ''),
    client_address:  String(row.client_address || ''),
    client_email:    String(row.client_email || ''),
    issue_date:      fmtDate(row.issue_date),
    due_date:        fmtDate(row.due_date),
    validity_date:   fmtDate(row.validity_date),
    items:           parseItems(row.items),
    subtotal:        Number(row.subtotal || 0),
    tax_rate:        Number(row.tax_rate ?? 16),
    tax_amount:      Number(row.tax_amount || 0),
    total:           Number(row.total || 0),
    notes:           String(row.notes || ''),
    terms:           String(row.terms || ''),
    project_id:      row.project_id ? Number(row.project_id) : null,
    created_by:      String(row.created_by || ''),
    created_at:      String(row.created_at || ''),
    converted_from:  row.converted_from ? Number(row.converted_from) : null,
  }
}

function rowToDN(row: Record<string, unknown>): DeliveryNote {
  return {
    id:            Number(row.id),
    dn_no:         String(row.dn_no || ''),
    invoice_id:    row.invoice_id ? Number(row.invoice_id) : null,
    invoice_no:    String(row.invoice_no || ''),
    project_id:    row.project_id ? Number(row.project_id) : null,
    delivery_date: fmtDate(row.delivery_date),
    delivered_to:  String(row.delivered_to || ''),
    received_by:   String(row.received_by || ''),
    items:         parseItems(row.items),
    notes:         String(row.notes || ''),
    created_by:    String(row.created_by || ''),
    created_at:    String(row.created_at || ''),
  }
}

function makeDocNo(type: DocType, id: number): string {
  const prefix = type === 'quotation' ? 'QT' : type === 'lpo' ? 'LPO' : 'INV'
  const year   = new Date().getFullYear()
  return `${prefix}-${year}-${String(id).padStart(4, '0')}`
}

// ─── Invoices ──────────────────────────────────────────────────────────────────

export async function getInvoices(filters?: {
  type?: DocType; status?: InvoiceStatus; company?: string
}): Promise<Invoice[]> {
  await ensureFinanceTables()
  const conds: string[] = []
  const vals:  unknown[] = []
  if (filters?.type)    { conds.push(`type = $${vals.length+1}`);             vals.push(filters.type) }
  if (filters?.status)  { conds.push(`status = $${vals.length+1}`);           vals.push(filters.status) }
  if (filters?.company) { conds.push(`issuing_company = $${vals.length+1}`);  vals.push(filters.company) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM invoices ${where} ORDER BY created_at DESC`, vals
  )
  return rows.map(rowToInvoice)
}

export async function getInvoiceById(id: number): Promise<Invoice | null> {
  await ensureFinanceTables()
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM invoices WHERE id = $1', [id])
  return row ? rowToInvoice(row) : null
}

export async function createInvoice(data: {
  type:            DocType
  issuing_company: string
  client_name:     string
  client_address:  string
  client_email:    string
  issue_date:      string
  due_date:        string
  validity_date:   string
  items:           InvoiceItem[]
  subtotal:        number
  tax_rate:        number
  tax_amount:      number
  total:           number
  notes:           string
  terms:           string
  project_id:      number | null
  created_by:      string
}): Promise<Invoice> {
  await ensureFinanceTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO invoices
       (type, issuing_company, client_name, client_address, client_email,
        issue_date, due_date, validity_date, items, subtotal, tax_rate,
        tax_amount, total, notes, terms, project_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
     RETURNING *`,
    [
      data.type, data.issuing_company, data.client_name, data.client_address, data.client_email,
      data.issue_date || null, data.due_date || null, data.validity_date || null,
      JSON.stringify(data.items), data.subtotal, data.tax_rate,
      data.tax_amount, data.total, data.notes, data.terms,
      data.project_id || null, data.created_by,
    ]
  )
  if (!row) throw new Error('Failed to create invoice')
  const docNo = makeDocNo(data.type, Number(row.id))
  await execute(`UPDATE invoices SET doc_no = $1 WHERE id = $2`, [docNo, row.id])
  return rowToInvoice({ ...row, doc_no: docNo })
}

export async function updateInvoice(id: number, data: Partial<{
  status:         InvoiceStatus
  client_name:    string
  client_address: string
  client_email:   string
  issue_date:     string
  due_date:       string
  validity_date:  string
  items:          InvoiceItem[]
  subtotal:       number
  tax_rate:       number
  tax_amount:     number
  total:          number
  notes:          string
  terms:          string
  project_id:     number | null
  issuing_company: string
}>): Promise<Invoice | null> {
  await ensureFinanceTables()
  const allowed = ['status','client_name','client_address','client_email','issue_date',
    'due_date','validity_date','items','subtotal','tax_rate','tax_amount','total',
    'notes','terms','project_id','issuing_company']
  const fields = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string,unknown>)[k] !== undefined)
  if (!fields.length) return getInvoiceById(id)
  const set    = fields.map((f, i) => f === 'items' ? `${f} = $${i+2}::jsonb` : `${f} = $${i+2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if (f === 'items') return JSON.stringify(v)
    if ((f === 'due_date' || f === 'validity_date' || f === 'issue_date') && !v) return null
    if (f === 'project_id' && !v) return null
    return v
  })
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE invoices SET ${set} WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToInvoice(row) : null
}

export async function deleteInvoice(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM invoices WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

export async function convertToInvoice(id: number, createdBy: string): Promise<Invoice> {
  await ensureFinanceTables()
  const quote = await getInvoiceById(id)
  if (!quote || quote.type !== 'quotation') throw new Error('Not a quotation')
  const invoice = await createInvoice({
    type:            'invoice',
    issuing_company: quote.issuing_company,
    client_name:     quote.client_name,
    client_address:  quote.client_address,
    client_email:    quote.client_email,
    issue_date:      new Date().toISOString().slice(0, 10),
    due_date:        '',
    validity_date:   '',
    items:           quote.items,
    subtotal:        quote.subtotal,
    tax_rate:        quote.tax_rate,
    tax_amount:      quote.tax_amount,
    total:           quote.total,
    notes:           quote.notes,
    terms:           quote.terms,
    project_id:      quote.project_id,
    created_by:      createdBy,
  })
  await execute(
    `UPDATE invoices SET converted_from = $1 WHERE id = $2`, [id, invoice.id]
  )
  await updateInvoice(id, { status: 'accepted' })
  return { ...invoice, converted_from: id }
}

// ─── Delivery Notes ────────────────────────────────────────────────────────────

export async function getDeliveryNotes(invoiceId?: number): Promise<DeliveryNote[]> {
  await ensureFinanceTables()
  const rows = invoiceId
    ? await query<Record<string, unknown>>('SELECT * FROM delivery_notes WHERE invoice_id = $1 ORDER BY created_at DESC', [invoiceId])
    : await query<Record<string, unknown>>('SELECT * FROM delivery_notes ORDER BY created_at DESC')
  return rows.map(rowToDN)
}

export async function getDeliveryNoteById(id: number): Promise<DeliveryNote | null> {
  await ensureFinanceTables()
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM delivery_notes WHERE id = $1', [id])
  return row ? rowToDN(row) : null
}

export async function createDeliveryNote(data: {
  invoice_id:    number | null
  invoice_no:    string
  project_id:    number | null
  delivery_date: string
  delivered_to:  string
  received_by:   string
  items:         InvoiceItem[]
  notes:         string
  created_by:    string
}): Promise<DeliveryNote> {
  await ensureFinanceTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO delivery_notes
       (invoice_id, invoice_no, project_id, delivery_date, delivered_to, received_by, items, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      data.invoice_id || null, data.invoice_no, data.project_id || null,
      data.delivery_date || null, data.delivered_to, data.received_by,
      JSON.stringify(data.items), data.notes, data.created_by,
    ]
  )
  if (!row) throw new Error('Failed to create delivery note')
  const dnNo = `DN-${new Date().getFullYear()}-${String(row.id).padStart(4, '0')}`
  await execute(`UPDATE delivery_notes SET dn_no = $1 WHERE id = $2`, [dnNo, row.id])
  return rowToDN({ ...row, dn_no: dnNo })
}

export async function updateDeliveryNote(id: number, data: Partial<{
  delivery_date: string; delivered_to: string; received_by: string
  items: InvoiceItem[]; notes: string
}>): Promise<DeliveryNote | null> {
  await ensureFinanceTables()
  const allowed = ['delivery_date','delivered_to','received_by','items','notes']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return getDeliveryNoteById(id)
  const set    = fields.map((f, i) => f === 'items' ? `${f} = $${i+2}::jsonb` : `${f} = $${i+2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    return f === 'items' ? JSON.stringify(v) : v
  })
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE delivery_notes SET ${set} WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToDN(row) : null
}

export async function deleteDeliveryNote(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM delivery_notes WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ─── Dashboard stats ───────────────────────────────────────────────────────────

export async function getFinanceStats(): Promise<{
  totalInvoiced: number
  totalPaid:     number
  outstanding:   number
  overdue:       number
  draftCount:    number
  quoteCount:    number
  invoiceCount:  number
}> {
  await ensureFinanceTables()
  const today = new Date().toISOString().slice(0, 10)

  // Auto-mark overdue
  await execute(
    `UPDATE invoices SET status = 'overdue'
     WHERE status = 'sent' AND due_date IS NOT NULL AND due_date < $1`, [today]
  ).catch(() => {})

  const rows = await query<Record<string, unknown>>(`
    SELECT
      COALESCE(SUM(total) FILTER (WHERE type='invoice'), 0)                          AS total_invoiced,
      COALESCE(SUM(total) FILTER (WHERE type='invoice' AND status='paid'), 0)        AS total_paid,
      COALESCE(SUM(total) FILTER (WHERE type='invoice' AND status IN ('sent','accepted','overdue')), 0) AS outstanding,
      COALESCE(SUM(total) FILTER (WHERE type='invoice' AND status='overdue'), 0)     AS overdue,
      COUNT(*)  FILTER (WHERE status='draft')                                        AS draft_count,
      COUNT(*)  FILTER (WHERE type='quotation' AND status NOT IN ('cancelled'))      AS quote_count,
      COUNT(*)  FILTER (WHERE type='invoice'   AND status NOT IN ('cancelled'))      AS invoice_count
    FROM invoices
  `)
  const r = rows[0] || {}
  return {
    totalInvoiced: Number(r.total_invoiced || 0),
    totalPaid:     Number(r.total_paid     || 0),
    outstanding:   Number(r.outstanding    || 0),
    overdue:       Number(r.overdue        || 0),
    draftCount:    Number(r.draft_count    || 0),
    quoteCount:    Number(r.quote_count    || 0),
    invoiceCount:  Number(r.invoice_count  || 0),
  }
}

// ─── Company letterhead ────────────────────────────────────────────────────────

export const COMPANY_LETTERHEAD: Record<string, {
  name: string; address: string[]; phone: string; email: string; pin: string
}> = {
  'BYTEWISE':    { name:'Bytewise Limited',                       address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'WELWYN':      { name:'Welwyn Limited',                         address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'DR.PHARMA':   { name:'Dr. Pharma Limited',                     address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'PIL':         { name:'PIL Limited',                            address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'MERCURY':     { name:'Mercury Limited',                        address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'MALI CREDIT': { name:'Mali Credit Limited',                    address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'MALEE':       { name:'Malee Limited',                          address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'GHPL':        { name:'GHPL Limited',                           address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'UNIFRESH':    { name:'Unifresh Limited',                       address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'PDL':         { name:'PDL Limited',                            address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'USM':         { name:'USM Limited',                            address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'MAXITOWER':   { name:'Maxitower Limited',                      address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'EURO TOWERS': { name:'Euro Towers Limited',                    address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'EPPL':        { name:'EPPL Limited',                           address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'BERLIN_BNK':  { name:'Berlin Bank Limited',                    address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'IIGENTRA':    { name:'Iigentra Limited',                       address:['Nairobi, Kenya'], phone:'', email:'', pin:'' },
  'KISCOL':      { name:'Kwale International Sugar Company Ltd',  address:['Kwale, Kenya'],   phone:'', email:'', pin:'' },
}
