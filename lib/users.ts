import { query, queryOne, execute } from './database'
import { UserRole } from './auth'

export interface StoredUser {
  id: string
  name: string
  email: string
  role: UserRole
  password_hash: string
  created_at: string
}

function rowToUser(row: Record<string, unknown>): StoredUser {
  return {
    id:            String(row.id),
    name:          String(row.name),
    email:         String(row.email),
    role:          row.role as UserRole,
    password_hash: String(row.password_hash),
    created_at:    String(row.created_at),
  }
}

export async function getUsers(): Promise<StoredUser[]> {
  const rows = await query<Record<string, unknown>>('SELECT * FROM users ORDER BY name')
  return rows.map(rowToUser)
}

export async function getUserByEmail(email: string): Promise<StoredUser | undefined> {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  )
  return row ? rowToUser(row) : undefined
}

export async function getPublicUsers() {
  const rows = await query<Record<string, unknown>>(
    'SELECT id, name, email, role FROM users ORDER BY name'
  )
  return rows.map(r => ({
    id:    String(r.id),
    name:  String(r.name),
    email: String(r.email),
    role:  r.role as UserRole,
  }))
}

export async function updateUserPassword(userId: string, newHash: string): Promise<boolean> {
  try {
    await execute('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId])
    return true
  } catch {
    return false
  }
}
