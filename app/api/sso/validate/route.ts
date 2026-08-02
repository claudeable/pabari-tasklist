// ============================================================
// PABARI ERP — SSO Token Validator
// Portal: Pabari ERP (master hub)
// Called SERVER-SIDE by sub-portals to verify an SSO token.
// Returns user identity so the sub-portal can issue its own session.
// Tokens are single-use and expire after 60 seconds.
//
// Called by:
//   - PIL backend:  POST /api/v1/auth/sso  (server → server)
//   - Smart Ops:    POST /api/auth/sso      (server → server)
// ============================================================
import { NextResponse } from 'next/server'
import { queryOne, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const { token } = await req.json().catch(() => ({})) as { token?: string }
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  const row = await queryOne<{
    id: number
    email: string
    name: string
    role: string
    portal: string
    expires_at: string
    used_at: string | null
  }>(
    `SELECT id, email, name, role, portal, expires_at, used_at
     FROM sso_tokens WHERE token = $1`,
    [token]
  ).catch(() => null)

  if (!row)                   return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  if (row.used_at)            return NextResponse.json({ error: 'Token already used' }, { status: 401 })
  if (new Date(row.expires_at) < new Date())
                              return NextResponse.json({ error: 'Token expired' }, { status: 401 })

  // Mark token as used (one-time only)
  await execute(
    'UPDATE sso_tokens SET used_at = NOW() WHERE id = $1',
    [row.id]
  ).catch(() => {})

  return NextResponse.json({
    email:  row.email,
    name:   row.name,
    role:   row.role,
    portal: row.portal,
  })
}
