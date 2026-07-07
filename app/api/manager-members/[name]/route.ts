import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { removeManagerMember } from '@/lib/managerMembers'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await removeManagerMember(user.email, decodeURIComponent(params.name))
  return NextResponse.json({ ok: true })
}
