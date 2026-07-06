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
    const rows = await query<{ count: string; maxid: string; senderids: string[] }>(
      `SELECT COUNT(*)::text as count, COALESCE(MAX(id),0)::text as maxid,
              COALESCE(ARRAY_AGG(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL), ARRAY[]::text[]) as senderids
       FROM chat_messages
       WHERE channel='dm' AND to_user_id=$1 AND id>$2`,
      [myId, since]
    )
    const count     = parseInt(rows[0]?.count ?? '0', 10)
    const maxId     = parseInt(rows[0]?.maxid ?? '0', 10)
    const senderIds = rows[0]?.senderids ?? []
    return NextResponse.json({ count, maxId, senderIds })
  } catch {
    return NextResponse.json({ count: 0, maxId: since, senderIds: [] })
  }
}
