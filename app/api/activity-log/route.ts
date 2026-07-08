import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getActivityLog } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null

  // Only Harshil (Director dept), Benson (Executive dept), and admin
  const canSeeLog = user?.role === 'admin' ||
    (user?.role === 'director' && (user.department === 'Director' || user.department === 'Executive'))
  if (!canSeeLog) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const from  = searchParams.get('from')  ?? undefined
  const to    = searchParams.get('to')    ?? undefined
  const u     = searchParams.get('user')  ?? undefined
  const limit = parseInt(searchParams.get('limit') ?? '200', 10)

  const entries = await getActivityLog({ from, to, user: u, limit })
  return NextResponse.json(entries)
}
