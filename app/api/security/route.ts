import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getBlockedIPs, getSecurityEvents, getSecurityStats } from '@/lib/security'

export const dynamic = 'force-dynamic'

function isSecurityAdmin(user: { role: string; name: string; department: string }) {
  return user.role === 'admin'
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || !isSecurityAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [blockedIPs, events, stats] = await Promise.all([
    getBlockedIPs(),
    getSecurityEvents(200),
    getSecurityStats(),
  ])

  return NextResponse.json({ blockedIPs, events, stats })
}
