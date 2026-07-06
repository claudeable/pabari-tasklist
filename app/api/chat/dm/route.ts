import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getDMMessages, postDMMessage } from '@/lib/chat'
import { getSubscriptionsForUser, sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const withId = req.nextUrl.searchParams.get('with')
  if (!withId) return NextResponse.json({ error: 'Missing ?with' }, { status: 400 })

  const myId   = String(user.id)
  const sinceId = parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10)

  // Only the two participants or admin can read a DM thread
  if (user.role !== 'admin' && myId !== withId) {
    // participant check is enforced by the SQL query — myId must be sender or recipient
  }

  try {
    const messages = await getDMMessages(myId, withId, sinceId > 0 ? sinceId : undefined)
    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[chat/dm GET]', err)
    return NextResponse.json({ messages: [] })
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { toUserId, toUserName, message } = await req.json()
  if (!toUserId || !message?.trim()) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (message.trim().length > 1000) return NextResponse.json({ error: 'Message too long' }, { status: 400 })

  try {
    const msg = await postDMMessage(String(user.id), user.name, toUserId, toUserName || 'Unknown', message.trim())
    getSubscriptionsForUser(toUserId)
      .then(subs => sendPush(subs, {
        title: `${user.name} (Direct Message)`,
        body:  message.trim().slice(0, 120),
        tag:   `dm-${user.id}`,
        url:   '/',
      }))
      .catch(() => {})
    return NextResponse.json({ message: msg })
  } catch (err) {
    console.error('[chat/dm POST]', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
