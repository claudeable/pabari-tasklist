import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { buildAuthUrl, DataCenter } from '@/lib/mail/zoho'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

// In production, store state in DB; in-memory is fine for single-instance
const pendingStates = new Map<string, { userId: string; dc: DataCenter; createdAt: number }>()

// Clean up states older than 10 minutes
function pruneStates() {
  const cutoff = Date.now() - 10 * 60 * 1000
  Array.from(pendingStates.entries()).forEach(([k, v]) => {
    if (v.createdAt < cutoff) pendingStates.delete(k)
  })
}

// Export so callback can verify state
export function verifyState(state: string): { userId: string; dc: DataCenter } | null {
  const entry = pendingStates.get(state)
  if (!entry) return null
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) { pendingStates.delete(state); return null }
  pendingStates.delete(state)
  return { userId: entry.userId, dc: entry.dc }
}

export async function GET(req: NextRequest) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  pruneStates()

  const dc = (req.nextUrl.searchParams.get('dc') ?? 'com') as DataCenter
  const state = randomBytes(16).toString('hex')
  pendingStates.set(state, { userId: user.id, dc, createdAt: Date.now() })

  const authUrl = buildAuthUrl(state, dc)
  return NextResponse.redirect(authUrl)
}
