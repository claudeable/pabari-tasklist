import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { pingPresence } from '@/lib/presence'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  try {
    await pingPresence(String(user.id), user.name)
  } catch (err) {
    console.error('[ping]', err)
  }
  return NextResponse.json({ ok: true })
}
