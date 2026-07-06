import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getSubscriptionsForUser, sendPush } from '@/lib/push'

export const dynamic = 'force-dynamic'

// Sends a test push to the current user — only for debugging
export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const subs = await getSubscriptionsForUser(String(user.id))
  if (subs.length === 0) return NextResponse.json({ error: 'No subscription found for your account. Make sure you clicked Enable in the chat and allowed notifications.' }, { status: 404 })

  await sendPush(subs, {
    title: '✅ Pabari ERP — Notifications working!',
    body:  `Push notifications are active for ${user.name}`,
    tag:   'push-test',
  })

  return NextResponse.json({ ok: true, subscriptions: subs.length })
}
