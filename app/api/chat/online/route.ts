import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getOnlineUsers } from '@/lib/chat'

export const dynamic = 'force-dynamic'

const HARSHIL_EMAIL = 'harshil@usc.co.ke'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if ((user.email ?? '').toLowerCase() !== HARSHIL_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const users = await getOnlineUsers()
    return NextResponse.json({ users })
  } catch (err) {
    console.error('[chat/online]', err)
    return NextResponse.json({ users: [] })
  }
}
