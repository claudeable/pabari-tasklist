import { query, execute } from './database'

// ── Ensure tables exist (singleton — runs only once per process) ──────────────

let _ready: Promise<void> | null = null
export function ensureTables(): Promise<void> {
  if (!_ready) _ready = _createTables().catch(err => { _ready = null; throw err })
  return _ready
}

async function _createTables() {
  await execute(`
    CREATE TABLE IF NOT EXISTS fin_invoices (
      id          SERIAL PRIMARY KEY,
      ref_no      TEXT NOT NULL UNIQUE,
      type        TEXT NOT NULL DEFAULT 'invoice', -- invoice | bill | receipt | lpo
      company     TEXT NOT NULL,
      counterpart TEXT NOT NULL,   -- vendor / client name
      description TEXT NOT NULL DEFAULT '',
      amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency    TEXT NOT NULL DEFAULT 'KES',
      issue_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      due_date    DATE,
      status      TEXT NOT NULL DEFAULT 'draft', -- draft | sent | approved | paid | overdue | cancelled
      notes       TEXT NOT NULL DEFAULT '',
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS fin_payments (
      id           SERIAL PRIMARY KEY,
      invoice_id   INT REFERENCES fin_invoices(id) ON DELETE SET NULL,
      company      TEXT NOT NULL,
      counterpart  TEXT NOT NULL,
      description  TEXT NOT NULL DEFAULT '',
      amount       NUMERIC(14,2) NOT NULL,
      currency     TEXT NOT NULL DEFAULT 'KES',
      payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
      method       TEXT NOT NULL DEFAULT 'bank', -- bank | mpesa | cash | cheque
      reference    TEXT NOT NULL DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'pending', -- pending | confirmed | failed
      created_by   TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS fin_budgets (
      id          SERIAL PRIMARY KEY,
      company     TEXT NOT NULL,
      category    TEXT NOT NULL,
      period      TEXT NOT NULL,          -- e.g. '2026-Q1', '2026-07'
      budgeted    NUMERIC(14,2) NOT NULL DEFAULT 0,
      spent       NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency    TEXT NOT NULL DEFAULT 'KES',
      notes       TEXT NOT NULL DEFAULT '',
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(company, category, period)
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS fin_assets (
      id            SERIAL PRIMARY KEY,
      asset_no      TEXT NOT NULL,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'equipment',
      company       TEXT NOT NULL,
      location      TEXT NOT NULL DEFAULT '',
      department    TEXT NOT NULL DEFAULT '',
      assigned_to   TEXT NOT NULL DEFAULT '',
      purchase_date DATE,
      purchase_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
      current_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency      TEXT NOT NULL DEFAULT 'KES',
      status        TEXT NOT NULL DEFAULT 'active',
      serial_no     TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      created_by    TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS fin_vehicles (
      id              SERIAL PRIMARY KEY,
      asset_id        INT REFERENCES fin_assets(id) ON DELETE SET NULL,
      reg_plate       TEXT NOT NULL,
      make            TEXT NOT NULL DEFAULT '',
      model           TEXT NOT NULL DEFAULT '',
      year            INT,
      company         TEXT NOT NULL,
      assigned_driver TEXT NOT NULL DEFAULT '',
      fuel_type       TEXT NOT NULL DEFAULT 'petrol',
      mileage         INT NOT NULL DEFAULT 0,
      insurance_expiry DATE,
      service_due_date DATE,
      service_due_km  INT,
      status          TEXT NOT NULL DEFAULT 'active',
      notes           TEXT NOT NULL DEFAULT '',
      created_by      TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await execute(`
    CREATE TABLE IF NOT EXISTS fin_maintenance (
      id           SERIAL PRIMARY KEY,
      asset_id     INT REFERENCES fin_assets(id) ON DELETE CASCADE,
      vehicle_id   INT REFERENCES fin_vehicles(id) ON DELETE CASCADE,
      date         DATE NOT NULL DEFAULT CURRENT_DATE,
      description  TEXT NOT NULL,
      cost         NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency     TEXT NOT NULL DEFAULT 'KES',
      provider     TEXT NOT NULL DEFAULT '',
      next_service DATE,
      created_by   TEXT NOT NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export interface Invoice {
  id:          number
  ref_no:      string
  type:        string
  company:     string
  counterpart: string
  description: string
  amount:      number
  currency:    string
  issue_date:  string
  due_date:    string | null
  status:      string
  notes:       string
  created_by:  string
  created_at:  string
  updated_at:  string
}

function rowToInvoice(r: Record<string, unknown>): Invoice {
  return {
    id:          Number(r.id),
    ref_no:      String(r.ref_no),
    type:        String(r.type),
    company:     String(r.company),
    counterpart: String(r.counterpart),
    description: String(r.description || ''),
    amount:      Number(r.amount),
    currency:    String(r.currency || 'KES'),
    issue_date:  String(r.issue_date || '').slice(0, 10),
    due_date:    r.due_date ? String(r.due_date).slice(0, 10) : null,
    status:      String(r.status),
    notes:       String(r.notes || ''),
    created_by:  String(r.created_by),
    created_at:  String(r.created_at),
    updated_at:  String(r.updated_at),
  }
}

export async function getInvoices(filters?: { company?: string; status?: string; type?: string }): Promise<Invoice[]> {
  await ensureTables()
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters?.company) { conditions.push(`company = $${params.length + 1}`); params.push(filters.company) }
  if (filters?.status)  { conditions.push(`status = $${params.length + 1}`); params.push(filters.status) }
  if (filters?.type)    { conditions.push(`type = $${params.length + 1}`); params.push(filters.type) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query<Record<string, unknown>>(`SELECT * FROM fin_invoices ${where} ORDER BY created_at DESC`, params)
  return rows.map(rowToInvoice)
}

export async function createInvoice(data: Omit<Invoice, 'id' | 'created_at' | 'updated_at'>): Promise<Invoice> {
  await ensureTables()
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO fin_invoices (ref_no,type,company,counterpart,description,amount,currency,issue_date,due_date,status,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [data.ref_no, data.type, data.company, data.counterpart, data.description, data.amount,
     data.currency, data.issue_date, data.due_date || null, data.status, data.notes, data.created_by]
  )
  return rowToInvoice(rows[0])
}

export async function updateInvoice(id: number, data: Partial<Omit<Invoice, 'id' | 'created_at'>>): Promise<Invoice | null> {
  await ensureTables()
  const allowed = ['ref_no','type','company','counterpart','description','amount','currency','issue_date','due_date','status','notes']
  const fields  = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set    = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => (data as Record<string, unknown>)[f])
  const rows = await query<Record<string, unknown>>(
    `UPDATE fin_invoices SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] ? rowToInvoice(rows[0]) : null
}

export async function deleteInvoice(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM fin_invoices WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ── Payments ──────────────────────────────────────────────────────────────────

export interface Payment {
  id:           number
  invoice_id:   number | null
  company:      string
  counterpart:  string
  description:  string
  amount:       number
  currency:     string
  payment_date: string
  method:       string
  reference:    string
  status:       string
  created_by:   string
  created_at:   string
}

function rowToPayment(r: Record<string, unknown>): Payment {
  return {
    id:           Number(r.id),
    invoice_id:   r.invoice_id ? Number(r.invoice_id) : null,
    company:      String(r.company),
    counterpart:  String(r.counterpart),
    description:  String(r.description || ''),
    amount:       Number(r.amount),
    currency:     String(r.currency || 'KES'),
    payment_date: String(r.payment_date || '').slice(0, 10),
    method:       String(r.method),
    reference:    String(r.reference || ''),
    status:       String(r.status),
    created_by:   String(r.created_by),
    created_at:   String(r.created_at),
  }
}

export async function getPayments(filters?: { company?: string; status?: string }): Promise<Payment[]> {
  await ensureTables()
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters?.company) { conditions.push(`company = $${params.length + 1}`); params.push(filters.company) }
  if (filters?.status)  { conditions.push(`status = $${params.length + 1}`); params.push(filters.status) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query<Record<string, unknown>>(`SELECT * FROM fin_payments ${where} ORDER BY payment_date DESC, created_at DESC`, params)
  return rows.map(rowToPayment)
}

export async function createPayment(data: Omit<Payment, 'id' | 'created_at'>): Promise<Payment> {
  await ensureTables()
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO fin_payments (invoice_id,company,counterpart,description,amount,currency,payment_date,method,reference,status,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [data.invoice_id || null, data.company, data.counterpart, data.description, data.amount,
     data.currency, data.payment_date, data.method, data.reference, data.status, data.created_by]
  )
  return rowToPayment(rows[0])
}

export async function updatePayment(id: number, data: Partial<Omit<Payment, 'id' | 'created_at'>>): Promise<Payment | null> {
  await ensureTables()
  const allowed = ['company','counterpart','description','amount','currency','payment_date','method','reference','status','invoice_id']
  const fields  = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set    = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => (data as Record<string, unknown>)[f])
  const rows = await query<Record<string, unknown>>(
    `UPDATE fin_payments SET ${set} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return rows[0] ? rowToPayment(rows[0]) : null
}

export async function deletePayment(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM fin_payments WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export interface Budget {
  id:        number
  company:   string
  category:  string
  period:    string
  budgeted:  number
  spent:     number
  currency:  string
  notes:     string
  created_by: string
  created_at: string
}

function rowToBudget(r: Record<string, unknown>): Budget {
  return {
    id:         Number(r.id),
    company:    String(r.company),
    category:   String(r.category),
    period:     String(r.period),
    budgeted:   Number(r.budgeted),
    spent:      Number(r.spent),
    currency:   String(r.currency || 'KES'),
    notes:      String(r.notes || ''),
    created_by: String(r.created_by),
    created_at: String(r.created_at),
  }
}

export async function getBudgets(filters?: { company?: string; period?: string }): Promise<Budget[]> {
  await ensureTables()
  const conditions: string[] = []
  const params: unknown[] = []
  if (filters?.company) { conditions.push(`company = $${params.length + 1}`); params.push(filters.company) }
  if (filters?.period)  { conditions.push(`period = $${params.length + 1}`); params.push(filters.period) }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = await query<Record<string, unknown>>(`SELECT * FROM fin_budgets ${where} ORDER BY period DESC, company`, params)
  return rows.map(rowToBudget)
}

export async function upsertBudget(data: Omit<Budget, 'id' | 'created_at'>): Promise<Budget> {
  await ensureTables()
  const rows = await query<Record<string, unknown>>(
    `INSERT INTO fin_budgets (company,category,period,budgeted,spent,currency,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (company,category,period) DO UPDATE
     SET budgeted=$4, spent=$5, currency=$6, notes=$7
     RETURNING *`,
    [data.company, data.category, data.period, data.budgeted, data.spent, data.currency, data.notes, data.created_by]
  )
  return rowToBudget(rows[0])
}

// ── Finance Tasks (read from main tasks table) ────────────────────────────────

export interface FinanceTask {
  id:          string
  date:        string
  company:     string
  particulars: string
  responsible: string
  status:      string
  priority:    string
  hk_comment:  string
  hod_comment: string
  due_date:    string
  updates:     string
  task_updates: { id: string; date: string; text: string }[]
}

export async function getFinanceTasks(): Promise<FinanceTask[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT t.id::text, t.date, t.company, t.particulars, t.responsible,
           t.status, t.priority, t.hk_comment, t.hod_comment, t.due_date, t.updates,
           COALESCE(
             json_agg(json_build_object('id', tu.id::text, 'date', tu.date, 'text', tu.text)
               ORDER BY tu.created_at DESC) FILTER (WHERE tu.id IS NOT NULL), '[]'
           ) AS task_updates
    FROM tasks t
    LEFT JOIN task_updates tu ON tu.task_id = t.id
    WHERE t.category = 'Finance'
    GROUP BY t.id
    ORDER BY t.created_at DESC
  `)
  return rows.map(r => ({
    id:          String(r.id),
    date:        String(r.date || ''),
    company:     String(r.company),
    particulars: String(r.particulars),
    responsible: String(r.responsible),
    status:      String(r.status),
    priority:    String(r.priority || 'medium'),
    hk_comment:  String(r.hk_comment || ''),
    hod_comment: String(r.hod_comment || ''),
    due_date:    String(r.due_date || ''),
    updates:     String(r.updates || ''),
    task_updates: Array.isArray(r.task_updates) ? r.task_updates as { id: string; date: string; text: string }[] : [],
  }))
}

// ── Summary ───────────────────────────────────────────────────────────────────

// ── Assets ────────────────────────────────────────────────────────────────────

export interface Asset {
  id:            number
  asset_no:      string
  name:          string
  type:          string
  company:       string
  location:      string
  department:    string
  assigned_to:   string
  purchase_date: string | null
  purchase_cost: number
  current_value: number
  currency:      string
  status:        string
  serial_no:     string
  notes:         string
  created_by:    string
  created_at:    string
  updated_at:    string
}

function rowToAsset(r: Record<string,unknown>): Asset {
  return {
    id:            Number(r.id),
    asset_no:      String(r.asset_no),
    name:          String(r.name),
    type:          String(r.type),
    company:       String(r.company),
    location:      String(r.location||''),
    department:    String(r.department||''),
    assigned_to:   String(r.assigned_to||''),
    purchase_date: r.purchase_date ? String(r.purchase_date).slice(0,10) : null,
    purchase_cost: Number(r.purchase_cost),
    current_value: Number(r.current_value),
    currency:      String(r.currency||'KES'),
    status:        String(r.status),
    serial_no:     String(r.serial_no||''),
    notes:         String(r.notes||''),
    created_by:    String(r.created_by),
    created_at:    String(r.created_at),
    updated_at:    String(r.updated_at),
  }
}

export async function getAssets(filters?: { company?: string; type?: string; status?: string }): Promise<Asset[]> {
  await ensureTables()
  const conds: string[] = []; const params: unknown[] = []
  if (filters?.company) { conds.push(`company = $${params.length+1}`); params.push(filters.company) }
  if (filters?.type)    { conds.push(`type = $${params.length+1}`);    params.push(filters.type) }
  if (filters?.status)  { conds.push(`status = $${params.length+1}`);  params.push(filters.status) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string,unknown>>(`SELECT * FROM fin_assets ${where} ORDER BY company, name`, params)
  return rows.map(rowToAsset)
}

export async function createAsset(data: Omit<Asset,'id'|'created_at'|'updated_at'>): Promise<Asset> {
  await ensureTables()
  const rows = await query<Record<string,unknown>>(
    `INSERT INTO fin_assets (asset_no,name,type,company,location,department,assigned_to,purchase_date,purchase_cost,current_value,currency,status,serial_no,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [data.asset_no,data.name,data.type,data.company,data.location,data.department,data.assigned_to,data.purchase_date||null,data.purchase_cost,data.current_value,data.currency,data.status,data.serial_no,data.notes,data.created_by]
  )
  return rowToAsset(rows[0])
}

export async function updateAsset(id: number, data: Partial<Omit<Asset,'id'|'created_at'>>): Promise<Asset|null> {
  await ensureTables()
  const allowed = ['asset_no','name','type','company','location','department','assigned_to','purchase_date','purchase_cost','current_value','currency','status','serial_no','notes']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f,i) => `${f} = $${i+2}`).join(', ')
  const values = fields.map(f => (data as Record<string,unknown>)[f])
  const rows = await query<Record<string,unknown>>(`UPDATE fin_assets SET ${set}, updated_at=NOW() WHERE id=$1 RETURNING *`, [id,...values])
  return rows[0] ? rowToAsset(rows[0]) : null
}

export async function deleteAsset(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM fin_assets WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

export interface Vehicle {
  id:               number
  asset_id:         number | null
  reg_plate:        string
  make:             string
  model:            string
  year:             number | null
  company:          string
  assigned_driver:  string
  fuel_type:        string
  mileage:          number
  insurance_expiry: string | null
  service_due_date: string | null
  service_due_km:   number | null
  status:           string
  notes:            string
  created_by:       string
  created_at:       string
  updated_at:       string
}

function rowToVehicle(r: Record<string,unknown>): Vehicle {
  return {
    id:               Number(r.id),
    asset_id:         r.asset_id ? Number(r.asset_id) : null,
    reg_plate:        String(r.reg_plate),
    make:             String(r.make||''),
    model:            String(r.model||''),
    year:             r.year ? Number(r.year) : null,
    company:          String(r.company),
    assigned_driver:  String(r.assigned_driver||''),
    fuel_type:        String(r.fuel_type||'petrol'),
    mileage:          Number(r.mileage||0),
    insurance_expiry: r.insurance_expiry ? String(r.insurance_expiry).slice(0,10) : null,
    service_due_date: r.service_due_date ? String(r.service_due_date).slice(0,10) : null,
    service_due_km:   r.service_due_km ? Number(r.service_due_km) : null,
    status:           String(r.status),
    notes:            String(r.notes||''),
    created_by:       String(r.created_by),
    created_at:       String(r.created_at),
    updated_at:       String(r.updated_at),
  }
}

export async function getVehicles(filters?: { company?: string; status?: string }): Promise<Vehicle[]> {
  await ensureTables()
  const conds: string[] = []; const params: unknown[] = []
  if (filters?.company) { conds.push(`company = $${params.length+1}`); params.push(filters.company) }
  if (filters?.status)  { conds.push(`status = $${params.length+1}`);  params.push(filters.status) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string,unknown>>(`SELECT * FROM fin_vehicles ${where} ORDER BY company, reg_plate`, params)
  return rows.map(rowToVehicle)
}

export async function createVehicle(data: Omit<Vehicle,'id'|'created_at'|'updated_at'>): Promise<Vehicle> {
  await ensureTables()
  const rows = await query<Record<string,unknown>>(
    `INSERT INTO fin_vehicles (asset_id,reg_plate,make,model,year,company,assigned_driver,fuel_type,mileage,insurance_expiry,service_due_date,service_due_km,status,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [data.asset_id||null,data.reg_plate,data.make,data.model,data.year||null,data.company,data.assigned_driver,data.fuel_type,data.mileage,data.insurance_expiry||null,data.service_due_date||null,data.service_due_km||null,data.status,data.notes,data.created_by]
  )
  return rowToVehicle(rows[0])
}

export async function updateVehicle(id: number, data: Partial<Omit<Vehicle,'id'|'created_at'>>): Promise<Vehicle|null> {
  await ensureTables()
  const allowed = ['reg_plate','make','model','year','company','assigned_driver','fuel_type','mileage','insurance_expiry','service_due_date','service_due_km','status','notes','asset_id']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f,i) => `${f} = $${i+2}`).join(', ')
  const values = fields.map(f => (data as Record<string,unknown>)[f])
  const rows = await query<Record<string,unknown>>(`UPDATE fin_vehicles SET ${set}, updated_at=NOW() WHERE id=$1 RETURNING *`, [id,...values])
  return rows[0] ? rowToVehicle(rows[0]) : null
}

export async function deleteVehicle(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM fin_vehicles WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export interface MaintenanceLog {
  id:           number
  asset_id:     number | null
  vehicle_id:   number | null
  date:         string
  description:  string
  cost:         number
  currency:     string
  provider:     string
  next_service: string | null
  created_by:   string
  created_at:   string
}

function rowToLog(r: Record<string,unknown>): MaintenanceLog {
  return {
    id:           Number(r.id),
    asset_id:     r.asset_id ? Number(r.asset_id) : null,
    vehicle_id:   r.vehicle_id ? Number(r.vehicle_id) : null,
    date:         String(r.date||'').slice(0,10),
    description:  String(r.description),
    cost:         Number(r.cost||0),
    currency:     String(r.currency||'KES'),
    provider:     String(r.provider||''),
    next_service: r.next_service ? String(r.next_service).slice(0,10) : null,
    created_by:   String(r.created_by),
    created_at:   String(r.created_at),
  }
}

export async function getMaintenanceLogs(filters?: { asset_id?: number; vehicle_id?: number }): Promise<MaintenanceLog[]> {
  await ensureTables()
  const conds: string[] = []; const params: unknown[] = []
  if (filters?.asset_id)   { conds.push(`asset_id = $${params.length+1}`);   params.push(filters.asset_id) }
  if (filters?.vehicle_id) { conds.push(`vehicle_id = $${params.length+1}`); params.push(filters.vehicle_id) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string,unknown>>(`SELECT * FROM fin_maintenance ${where} ORDER BY date DESC`, params)
  return rows.map(rowToLog)
}

export async function createMaintenanceLog(data: Omit<MaintenanceLog,'id'|'created_at'>): Promise<MaintenanceLog> {
  await ensureTables()
  const rows = await query<Record<string,unknown>>(
    `INSERT INTO fin_maintenance (asset_id,vehicle_id,date,description,cost,currency,provider,next_service,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.asset_id||null,data.vehicle_id||null,data.date,data.description,data.cost,data.currency,data.provider,data.next_service||null,data.created_by]
  )
  return rowToLog(rows[0])
}

// ── Finance Summary ───────────────────────────────────────────────────────────

export async function getFinanceSummary() {
  await ensureTables()
  const [invoiceStats, paymentStats, taskStats, overdue] = await Promise.all([
    query<Record<string, unknown>>(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount),0) as total
      FROM fin_invoices GROUP BY status
    `),
    query<Record<string, unknown>>(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount),0) as total
      FROM fin_payments GROUP BY status
    `),
    query<Record<string, unknown>>(`
      SELECT status, COUNT(*) as count FROM tasks WHERE category='Finance' GROUP BY status
    `),
    query<Record<string, unknown>>(`
      SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total
      FROM fin_invoices WHERE due_date < CURRENT_DATE AND status NOT IN ('paid','cancelled')
    `),
  ])
  return { invoiceStats, paymentStats, taskStats, overdue: overdue[0] }
}
