import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const since = parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10)
  const myId  = String(user.id)

  try {
    const rows = await query<{ count: string; maxid: string }>(
      `SELECT COUNT(*)::text as count, COALESCE(MAX(id),0)::text as maxid
       FROM chat_messages
       WHERE channel='dm' AND to_user_id=$1 AND id>$2`,
      [myId, since]
    )
    const count = parseInt(rows[0]?.count ?? '0', 10)
    const maxId = parseInt(rows[0]?.maxid ?? '0', 10)
    return NextResponse.json({ count, maxId })
  } catch {
    return NextResponse.json({ count: 0, maxId: since })
  }
}
