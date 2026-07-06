import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMessages, postMessage, ChatChannel } from '@/lib/chat'

export const dynamic = 'force-dynamic'

const FINANCE_EMAIL = 'ateferi@kwale-group.com'

function canAccessChannel(user: { role: string; department: string; email?: string }, channel: ChatChannel): boolean {
  if (channel === 'all') return true
  if (channel === 'hod') return ['admin','director','manager'].includes(user.role)
  if (channel === 'finance') {
    return ['admin','director','ceo'].includes(user.role)
      || user.department === 'Finance'
      || (user.email ?? '').toLowerCase() === FINANCE_EMAIL
  }
  if (channel === 'system') return user.role === 'director' && user.department === 'Director'
  return false
}

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const channel = (req.nextUrl.searchParams.get('channel') ?? 'all') as ChatChannel
  if (!canAccessChannel(user, channel)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sinceId = parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10)
  try {
    const messages = await getMessages(channel, sinceId > 0 ? sinceId : undefined)
    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[chat/messages GET]', err)
    return NextResponse.json({ messages: [] })
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, channel = 'all' } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  if (message.trim().length > 1000) return NextResponse.json({ error: 'Message too long' }, { status: 400 })
  if (!canAccessChannel(user, channel as ChatChannel)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const msg = await postMessage(String(user.id), user.name, message, channel as ChatChannel)
    return NextResponse.json({ message: msg })
  } catch (err) {
    console.error('[chat/messages POST]', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
