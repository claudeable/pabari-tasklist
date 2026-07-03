import { SignJWT, jwtVerify } from 'jose'

export type UserRole = 'admin' | 'director' | 'ceo' | 'manager' | 'staff'

export interface SessionUser {
  id:         string
  name:       string
  email:      string
  role:       UserRole
  department: string
  reports_to: string
  companies:  string[]
}

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'pabari-erp-default-secret-change-in-production'
  )

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id, name: user.name, email: user.email, role: user.role,
    department: user.department, reports_to: user.reports_to,
    companies: user.companies,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    const p = payload as unknown as SessionUser
    // Ensure companies always has a valid value even for old tokens
    if (!Array.isArray(p.companies)) p.companies = ['ALL']
    return p
  } catch {
    return null
  }
}
