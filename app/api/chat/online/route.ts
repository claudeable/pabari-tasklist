import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getOnlineUsers } from '@/lib/presence'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ users: [] }, { status: 401 })

  try {
    const users = await getOnlineUsers()
    return NextResponse.json({ users })
  } catch {
    return NextResponse.json({ users: [] })
  }
}
