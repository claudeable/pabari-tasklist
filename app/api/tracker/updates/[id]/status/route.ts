import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { updateTrackerUpdate } from '@/lib/tracker'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { status } = await req.json()
  const u = await updateTrackerUpdate(Number(params.id), { status })
  return NextResponse.json(u)
}
