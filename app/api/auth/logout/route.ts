import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { postSystemMessage } from '@/lib/chat'

export async function POST() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  if (session?.value) {
    const user = await verifyToken(session.value).catch(() => null)
    if (user) postSystemMessage(`🔴 ${user.name} logged out`).catch(() => {})
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('pabari-session', '', {
    httpOnly: true,
    path:     '/',
    maxAge:   0,
  })
  return res
}
