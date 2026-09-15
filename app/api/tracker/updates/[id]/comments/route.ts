import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { addTrackerUpdateComment } from '@/lib/tracker'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Comment required' }, { status: 400 })
  const comment = await addTrackerUpdateComment({ update_id: Number(params.id), posted_by: user.name, body: body.trim() })
  return NextResponse.json(comment, { status: 201 })
}
