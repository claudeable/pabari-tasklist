// ============================================================
// PABARI ERP — SSO Token Generator
// Portal: Pabari ERP (master hub)
// Called by the UnifiedHub when a user clicks a sub-portal card.
// Returns a 60-second one-time token that the sub-portal validates
// against /api/sso/validate before issuing its own session.
//
// Sub-portals that use this:
//   - PIL / KETRACO  → pil-transmission-lines-app.up.railway.app
//   - Smart Ops      → joint-collaboration-portal.vercel.app
//   - Property Mgmt  → (not yet deployed)
// ============================================================
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { execute, queryOne } from '@/lib/database'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// Map portal key → its base URL (update when Property is deployed)
const PORTAL_URLS: Record<string, string> = {
  pil:      'https://pil-transmission-lines-app.up.railway.app',
  smartops: 'https://joint-collaboration-portal.vercel.app',
  property: '',
}

export async function POST(req: Request) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { portal } = await req.json().catch(() => ({})) as { portal?: string }
  if (!portal || !PORTAL_URLS[portal])
    return NextResponse.json({ error: 'Unknown portal' }, { status: 400 })

  // Check the user has access to this portal
  const dbUser = await queryOne<{ portals: string[] }>(
    'SELECT portals FROM users WHERE email = $1',
    [user.email]
  ).catch(() => null)

  const userPortals: string[] = (dbUser as { portals?: string[] } | null)?.portals ?? []
  const hasAccess = user.role === 'admin' || userPortals.includes(portal)
  if (!hasAccess)
    return NextResponse.json({ error: 'No access to this portal' }, { status: 403 })

  // Generate a cryptographically random one-time token (60-second TTL)
  const token    = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 60_000)

  await execute(
    `INSERT INTO sso_tokens (token, email, name, role, portal, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [token, user.email, user.name, user.role, portal, expiresAt.toISOString()]
  )

  const redirectUrl = `${PORTAL_URLS[portal]}/auth/sso?token=${token}`
  return NextResponse.json({ token, redirect_url: redirectUrl })
}
