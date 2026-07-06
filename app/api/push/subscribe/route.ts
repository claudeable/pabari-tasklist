import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { saveSubscription, removeSubscription } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { subscription } = await req.json()
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  try {
    await saveSubscription(String(user.id), subscription)
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[push/subscribe POST]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const { endpoint } = await req.json().catch(() => ({}))
  if (endpoint) await removeSubscription(endpoint).catch(() => {})
  return NextResponse.json({ ok: true })
}
