import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { savePhoneForUser, getPhoneByEmail } from '@/lib/whatsapp'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const phone = await getPhoneByEmail(user.email)
  return NextResponse.json({ phone: phone ?? '' })
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json()
  if (phone && !/^\+?[\d\s\-]{7,15}$/.test(phone)) {
    return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 })
  }

  await savePhoneForUser(user.email, phone ?? '')
  return NextResponse.json({ ok: true })
}
