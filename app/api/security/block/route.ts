import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { blockIP, unblockIP, logSecurityEvent } from '@/lib/security'

export const dynamic = 'force-dynamic'

function isSecurityAdmin(user: { role: string; department: string }) {
  return user.role === 'admin'
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || !isSecurityAdmin(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { action, ip, reason, hours } = await req.json()

  if (!ip) return NextResponse.json({ error: 'IP required' }, { status: 400 })

  if (action === 'block') {
    await blockIP(ip, reason || 'Manually blocked', user.email, hours)
    await logSecurityEvent('manual_block', ip, user.email, `Blocked by ${user.name}: ${reason || ''}`, 100)
    return NextResponse.json({ ok: true })
  }

  if (action === 'unblock') {
    await unblockIP(ip)
    await logSecurityEvent('manual_unblock', ip, user.email, `Unblocked by ${user.name}`, 0)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
