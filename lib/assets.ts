import { query, execute } from './database'

let _ready: Promise<void> | null = null
export function ensureAssetTables(): Promise<void> {
  if (!_ready) _ready = _createTables().catch(err => { _ready = null; throw err })
  return _ready
}

async function _createTables() {
  await execute(`
    CREATE TABLE IF NOT EXISTS fin_assets (
      id            SERIAL PRIMARY KEY,
      asset_no      TEXT NOT NULL,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL DEFAULT 'Equipment',
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
      id                    SERIAL PRIMARY KEY,
      asset_id              INT REFERENCES fin_assets(id) ON DELETE SET NULL,
      reg_plate             TEXT NOT NULL,
      make                  TEXT NOT NULL DEFAULT '',
      model                 TEXT NOT NULL DEFAULT '',
      year                  INT,
      company               TEXT NOT NULL,
      assigned_driver       TEXT NOT NULL DEFAULT '',
      fuel_type             TEXT NOT NULL DEFAULT 'Diesel',
      mileage               INT NOT NULL DEFAULT 0,
      insurance_expiry      DATE,
      service_due_date      DATE,
      service_due_km        INT,
      inspection_expiry     DATE,
      road_license_expiry   DATE,
      driver_license_expiry DATE,
      psv_license_expiry    DATE,
      status                TEXT NOT NULL DEFAULT 'active',
      notes                 TEXT NOT NULL DEFAULT '',
      created_by            TEXT NOT NULL,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  // Safe upgrades for existing tables
  for (const col of ['inspection_expiry','road_license_expiry','driver_license_expiry','psv_license_expiry']) {
    await execute(`ALTER TABLE fin_vehicles ADD COLUMN IF NOT EXISTS ${col} DATE`)
  }
  await execute(`
    CREATE TABLE IF NOT EXISTS fin_maintenance (
      id         SERIAL PRIMARY KEY,
      asset_id   INT REFERENCES fin_assets(id) ON DELETE CASCADE,
      vehicle_id INT REFERENCES fin_vehicles(id) ON DELETE CASCADE,
      date       DATE NOT NULL DEFAULT CURRENT_DATE,
      description TEXT NOT NULL,
      cost       NUMERIC(14,2) NOT NULL DEFAULT 0,
      currency   TEXT NOT NULL DEFAULT 'KES',
      provider   TEXT NOT NULL DEFAULT '',
      next_service DATE,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Asset {
  id: number; asset_no: string; name: string; type: string; company: string
  location: string; department: string; assigned_to: string
  purchase_date: string | null; purchase_cost: number; current_value: number
  currency: string; status: string; serial_no: string; notes: string
  created_by: string; created_at: string; updated_at: string
}

export interface Vehicle {
  id: number; asset_id: number | null; reg_plate: string; make: string; model: string
  year: number | null; company: string; assigned_driver: string; fuel_type: string
  mileage: number; insurance_expiry: string | null; inspection_expiry: string | null
  road_license_expiry: string | null; driver_license_expiry: string | null
  psv_license_expiry: string | null; service_due_date: string | null
  service_due_km: number | null; status: string; notes: string
  created_by: string; created_at: string; updated_at: string
}

export interface MaintenanceLog {
  id: number; asset_id: number | null; vehicle_id: number | null
  date: string; description: string; cost: number; currency: string
  provider: string; next_service: string | null; created_by: string; created_at: string
}

// ── Row mappers ───────────────────────────────────────────────────────────────

function toAsset(r: Record<string,unknown>): Asset {
  return {
    id: Number(r.id), asset_no: String(r.asset_no), name: String(r.name),
    type: String(r.type), company: String(r.company),
    location: String(r.location||''), department: String(r.department||''),
    assigned_to: String(r.assigned_to||''),
    purchase_date: r.purchase_date ? String(r.purchase_date).slice(0,10) : null,
    purchase_cost: Number(r.purchase_cost), current_value: Number(r.current_value),
    currency: String(r.currency||'KES'), status: String(r.status),
    serial_no: String(r.serial_no||''), notes: String(r.notes||''),
    created_by: String(r.created_by), created_at: String(r.created_at), updated_at: String(r.updated_at),
  }
}

function toVehicle(r: Record<string,unknown>): Vehicle {
  const d = (k: string) => r[k] ? String(r[k]).slice(0,10) : null
  return {
    id: Number(r.id), asset_id: r.asset_id ? Number(r.asset_id) : null,
    reg_plate: String(r.reg_plate), make: String(r.make||''), model: String(r.model||''),
    year: r.year ? Number(r.year) : null, company: String(r.company),
    assigned_driver: String(r.assigned_driver||''), fuel_type: String(r.fuel_type||'Diesel'),
    mileage: Number(r.mileage||0),
    insurance_expiry: d('insurance_expiry'), inspection_expiry: d('inspection_expiry'),
    road_license_expiry: d('road_license_expiry'), driver_license_expiry: d('driver_license_expiry'),
    psv_license_expiry: d('psv_license_expiry'), service_due_date: d('service_due_date'),
    service_due_km: r.service_due_km ? Number(r.service_due_km) : null,
    status: String(r.status), notes: String(r.notes||''),
    created_by: String(r.created_by), created_at: String(r.created_at), updated_at: String(r.updated_at),
  }
}

function toLog(r: Record<string,unknown>): MaintenanceLog {
  return {
    id: Number(r.id), asset_id: r.asset_id ? Number(r.asset_id) : null,
    vehicle_id: r.vehicle_id ? Number(r.vehicle_id) : null,
    date: String(r.date||'').slice(0,10), description: String(r.description),
    cost: Number(r.cost||0), currency: String(r.currency||'KES'),
    provider: String(r.provider||''),
    next_service: r.next_service ? String(r.next_service).slice(0,10) : null,
    created_by: String(r.created_by), created_at: String(r.created_at),
  }
}

// ── Assets ────────────────────────────────────────────────────────────────────

export async function getAssets(filters?: { company?: string; type?: string; status?: string }): Promise<Asset[]> {
  await ensureAssetTables()
  const conds: string[] = []; const params: unknown[] = []
  if (filters?.company) { conds.push(`company=$${params.length+1}`); params.push(filters.company) }
  if (filters?.type)    { conds.push(`type=$${params.length+1}`);    params.push(filters.type) }
  if (filters?.status)  { conds.push(`status=$${params.length+1}`);  params.push(filters.status) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string,unknown>>(`SELECT * FROM fin_assets ${where} ORDER BY company, name`, params)
  return rows.map(toAsset)
}

export async function createAsset(data: Omit<Asset,'id'|'created_at'|'updated_at'>): Promise<Asset> {
  await ensureAssetTables()
  const rows = await query<Record<string,unknown>>(
    `INSERT INTO fin_assets (asset_no,name,type,company,location,department,assigned_to,purchase_date,purchase_cost,current_value,currency,status,serial_no,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [data.asset_no,data.name,data.type,data.company,data.location,data.department,data.assigned_to,
     data.purchase_date||null,data.purchase_cost,data.current_value,data.currency,data.status,data.serial_no,data.notes,data.created_by]
  )
  return toAsset(rows[0])
}

export async function updateAsset(id: number, data: Partial<Omit<Asset,'id'|'created_at'>>): Promise<Asset|null> {
  await ensureAssetTables()
  const allowed = ['asset_no','name','type','company','location','department','assigned_to','purchase_date','purchase_cost','current_value','currency','status','serial_no','notes']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f,i) => `${f}=$${i+2}`).join(', ')
  const vals = fields.map(f => (data as Record<string,unknown>)[f])
  const rows = await query<Record<string,unknown>>(`UPDATE fin_assets SET ${set},updated_at=NOW() WHERE id=$1 RETURNING *`, [id,...vals])
  return rows[0] ? toAsset(rows[0]) : null
}

export async function deleteAsset(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM fin_assets WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ── Vehicles ──────────────────────────────────────────────────────────────────

export async function getVehicles(filters?: { company?: string; status?: string }): Promise<Vehicle[]> {
  await ensureAssetTables()
  const conds: string[] = []; const params: unknown[] = []
  if (filters?.company) { conds.push(`company=$${params.length+1}`); params.push(filters.company) }
  if (filters?.status)  { conds.push(`status=$${params.length+1}`);  params.push(filters.status) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string,unknown>>(`SELECT * FROM fin_vehicles ${where} ORDER BY company, reg_plate`, params)
  return rows.map(toVehicle)
}

export async function createVehicle(data: Omit<Vehicle,'id'|'created_at'|'updated_at'>): Promise<Vehicle> {
  await ensureAssetTables()
  const rows = await query<Record<string,unknown>>(
    `INSERT INTO fin_vehicles
       (asset_id,reg_plate,make,model,year,company,assigned_driver,fuel_type,mileage,
        insurance_expiry,inspection_expiry,road_license_expiry,driver_license_expiry,psv_license_expiry,
        service_due_date,service_due_km,status,notes,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [data.asset_id||null,data.reg_plate,data.make,data.model,data.year||null,
     data.company,data.assigned_driver,data.fuel_type,data.mileage,
     data.insurance_expiry||null,data.inspection_expiry||null,data.road_license_expiry||null,
     data.driver_license_expiry||null,data.psv_license_expiry||null,
     data.service_due_date||null,data.service_due_km||null,data.status,data.notes,data.created_by]
  )
  return toVehicle(rows[0])
}

export async function updateVehicle(id: number, data: Partial<Omit<Vehicle,'id'|'created_at'>>): Promise<Vehicle|null> {
  await ensureAssetTables()
  const allowed = ['reg_plate','make','model','year','company','assigned_driver','fuel_type','mileage',
    'insurance_expiry','inspection_expiry','road_license_expiry','driver_license_expiry','psv_license_expiry',
    'service_due_date','service_due_km','status','notes','asset_id']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f,i) => `${f}=$${i+2}`).join(', ')
  const vals = fields.map(f => (data as Record<string,unknown>)[f])
  const rows = await query<Record<string,unknown>>(`UPDATE fin_vehicles SET ${set},updated_at=NOW() WHERE id=$1 RETURNING *`, [id,...vals])
  return rows[0] ? toVehicle(rows[0]) : null
}

export async function deleteVehicle(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM fin_vehicles WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ── Maintenance ───────────────────────────────────────────────────────────────

export async function getMaintenanceLogs(filters?: { asset_id?: number; vehicle_id?: number }): Promise<MaintenanceLog[]> {
  await ensureAssetTables()
  const conds: string[] = []; const params: unknown[] = []
  if (filters?.asset_id)   { conds.push(`asset_id=$${params.length+1}`);   params.push(filters.asset_id) }
  if (filters?.vehicle_id) { conds.push(`vehicle_id=$${params.length+1}`); params.push(filters.vehicle_id) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const rows = await query<Record<string,unknown>>(`SELECT * FROM fin_maintenance ${where} ORDER BY date DESC`, params)
  return rows.map(toLog)
}

export async function createMaintenanceLog(data: Omit<MaintenanceLog,'id'|'created_at'>): Promise<MaintenanceLog> {
  await ensureAssetTables()
  const rows = await query<Record<string,unknown>>(
    `INSERT INTO fin_maintenance (asset_id,vehicle_id,date,description,cost,currency,provider,next_service,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.asset_id||null,data.vehicle_id||null,data.date,data.description,data.cost,data.currency,data.provider,data.next_service||null,data.created_by]
  )
  return toLog(rows[0])
}
