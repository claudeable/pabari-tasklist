import { SignJWT, jwtVerify } from 'jose'

export type UserRole = 'admin' | 'director' | 'ceo' | 'manager' | 'staff'

export interface SessionUser {
  id:         string
  name:       string
  email:      string
  role:       UserRole
  department: string
  reports_to: string
  hod_email:  string
  companies:  string[]
  portals:    string[]  // sub-portals this user can access: 'pil', 'smartops', 'property'
}

const secret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET environment variable is not set — set it in Railway before deploying')
  return new TextEncoder().encode(s)
}

export async function signToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id, name: user.name, email: user.email, role: user.role,
    department: user.department, reports_to: user.reports_to,
    hod_email: user.hod_email,
    companies: user.companies,
    portals:   user.portals,
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
    // Ensure arrays always have valid values even for old tokens
    if (!Array.isArray(p.companies)) p.companies = ['ALL']
    if (!Array.isArray(p.portals))   p.portals   = []
    if (!p.hod_email) p.hod_email = ''
    return p
  } catch {
    return null
  }
}
