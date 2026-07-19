import { SignJWT, jwtVerify } from 'jose'
import { query } from './database'
import bcrypt from 'bcryptjs'

export interface SessionUser {
  id:         string
  name:       string
  email:      string
  role:       string
  department: string
}

const FINANCE_EMAILS = new Set([
  'hkotecha@kwale-group.com',
  'pmureithi@usm.co.ke',
  'yaynalem@usm.co.ke',
  'rkrishnan@usm.co.ke',
  'ateferi@kwale-group.com',
])

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET not set')
  return new TextEncoder().encode(s)
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({ id: user.id, name: user.name, email: user.email, role: user.role, department: user.department })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    const p = payload as unknown as SessionUser
    if (!FINANCE_EMAILS.has((p.email || '').toLowerCase())) return null
    return p
  } catch {
    return null
  }
}

export async function loginUser(email: string, password: string): Promise<SessionUser | null> {
  if (!FINANCE_EMAILS.has(email.toLowerCase())) return null
  const row = await queryOne(email, password)
  if (!row) return null
  return row
}

async function queryOne(email: string, password: string): Promise<SessionUser | null> {
  const rows = await query<Record<string, unknown>>(
    `SELECT id, name, email, role, department, password_hash FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  )
  const row = rows[0]
  if (!row) return null
  const ok = await bcrypt.compare(password, String(row.password_hash))
  if (!ok) return null
  return {
    id:         String(row.id),
    name:       String(row.name),
    email:      String(row.email),
    role:       String(row.role),
    department: String(row.department || ''),
  }
}
