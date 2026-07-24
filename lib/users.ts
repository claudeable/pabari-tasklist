import { query, queryOne, execute } from './database'
import { UserRole } from './auth'

let userColsReady = false
async function ensureUserCols() {
  if (userColsReady) return
  await execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS hod_email TEXT NOT NULL DEFAULT ''")
  userColsReady = true
}

export interface StoredUser {
  id:            string
  name:          string
  email:         string
  role:          UserRole
  department:    string
  reports_to:    string
  hod_email:     string
  companies:     string[]
  password_hash: string
  created_at:    string
}

function rowToUser(row: Record<string, unknown>): StoredUser {
  let companies: string[] = ['ALL']
  if (Array.isArray(row.companies)) {
    companies = row.companies as string[]
  } else if (typeof row.companies === 'string') {
    try { companies = JSON.parse(row.companies) } catch { companies = ['ALL'] }
  }
  return {
    id:            String(row.id),
    name:          String(row.name),
    email:         String(row.email),
    role:          row.role as UserRole,
    department:    String(row.department || ''),
    reports_to:    String(row.reports_to || ''),
    hod_email:     String(row.hod_email || ''),
    companies,
    password_hash: String(row.password_hash),
    created_at:    String(row.created_at),
  }
}

export async function getUsers(): Promise<StoredUser[]> {
  await ensureUserCols()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM users ORDER BY name'
  )
  return rows.map(rowToUser)
}

export async function getUserByName(name: string): Promise<StoredUser | undefined> {
  await ensureUserCols()
  // Try exact match first, then first-name-only match as fallback
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM users WHERE LOWER(name) = LOWER($1)
        OR LOWER(SPLIT_PART(name, ' ', 1)) = LOWER($1)
     ORDER BY (LOWER(name) = LOWER($1)) DESC LIMIT 1`,
    [name]
  )
  return row ? rowToUser(row) : undefined
}

export async function getUserByEmail(email: string): Promise<StoredUser | undefined> {
  await ensureUserCols()
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  )
  return row ? rowToUser(row) : undefined
}

export async function getPublicUsers() {
  await ensureUserCols()
  const rows = await query<Record<string, unknown>>(
    'SELECT id, name, email, role, department, reports_to, hod_email, companies FROM users ORDER BY name'
  )
  return rows.map(r => {
    let companies: string[] = ['ALL']
    if (Array.isArray(r.companies)) companies = r.companies as string[]
    else if (typeof r.companies === 'string') { try { companies = JSON.parse(r.companies) } catch { /**/ } }
    return {
      id:         String(r.id),
      name:       String(r.name),
      email:      String(r.email),
      role:       r.role as UserRole,
      department: String(r.department || ''),
      reports_to: String(r.reports_to || ''),
      hod_email:  String(r.hod_email || ''),
      companies,
    }
  })
}

export async function getSubordinates(email: string): Promise<string[]> {
  const rows = await query<Record<string, unknown>>(
    'SELECT name FROM users WHERE LOWER(reports_to) = LOWER($1)',
    [email]
  )
  return rows.map(r => String(r.name))
}

export async function createUser(data: {
  name: string; email: string; role: UserRole
  department: string; reports_to: string; hod_email?: string; password_hash: string; companies?: string[]
}): Promise<StoredUser> {
  await ensureUserCols()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO users (name, email, role, department, reports_to, hod_email, companies, password_hash)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.name, data.email, data.role, data.department, data.reports_to,
     data.hod_email ?? '',
     JSON.stringify(data.companies ?? ['ALL']), data.password_hash]
  )
  if (!row) throw new Error('Failed to create user')
  return rowToUser(row)
}

export async function updateUser(id: string, data: {
  name?: string; email?: string; role?: UserRole
  department?: string; reports_to?: string; hod_email?: string; companies?: string[]
}): Promise<StoredUser | null> {
  await ensureUserCols()
  const { companies, ...rest } = data
  const allowed = ['name', 'email', 'role', 'department', 'reports_to', 'hod_email']
  const fields  = Object.keys(rest).filter(k => allowed.includes(k))

  // companies is JSONB — handle separately
  if (companies !== undefined) fields.push('companies')
  if (!fields.length) return null

  const set    = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => f === 'companies' ? JSON.stringify(companies) : (rest as Record<string, unknown>)[f])
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE users SET ${set} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
  return row ? rowToUser(row) : null
}

export async function resetUserPassword(id: string, hash: string): Promise<boolean> {
  try {
    await execute('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id])
    return true
  } catch { return false }
}

export async function updateUserPassword(userId: string, newHash: string): Promise<boolean> {
  return resetUserPassword(userId, newHash)
}

export async function deleteUser(id: string): Promise<boolean> {
  const rows = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}
