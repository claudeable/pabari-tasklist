import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getManagerMembers, addManagerMember } from '@/lib/managerMembers'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await getManagerMembers(user.email)
  return NextResponse.json({ members })
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { memberName } = await req.json()
  if (!memberName?.trim()) return NextResponse.json({ error: 'memberName required' }, { status: 400 })

  await addManagerMember(user.email, memberName.trim())
  return NextResponse.json({ ok: true })
}
