import { SignJWT, jwtVerify } from 'jose'

export type UserRole = 'admin' | 'director' | 'manager' | 'staff'

export interface SessionUser {
  id:         string
  name:       string
  email:      string
  role:       UserRole
  department: string
  reports_to: string
}

const secret = () =>
  new TextEncoder().encode(
    process.env.JWT_SECRET ?? 'pabari-erp-default-secret-change-in-production'
  )

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id, name: user.name, email: user.email, role: user.role,
    department: user.department, reports_to: user.reports_to,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret())
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret())
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}
