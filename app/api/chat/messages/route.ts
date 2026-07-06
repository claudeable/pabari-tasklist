import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMessages, postMessage } from '@/lib/chat'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sinceId = parseInt(req.nextUrl.searchParams.get('since') ?? '0', 10)
  try {
    const messages = await getMessages(sinceId > 0 ? sinceId : undefined)
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

  const { message } = await req.json()
  if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })
  if (message.trim().length > 1000) return NextResponse.json({ error: 'Message too long' }, { status: 400 })

  try {
    const msg = await postMessage(String(user.id), user.name, message)
    return NextResponse.json({ message: msg })
  } catch (err) {
    console.error('[chat/messages POST]', err)
    return NextResponse.json({ error: 'Failed to send' }, { status: 500 })
  }
}
