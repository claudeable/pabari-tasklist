import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMembers, addProjectMember, removeProjectMember } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const members = await getProjectMembers(parseInt(params.id, 10))
  return NextResponse.json(members)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_name, role } = await req.json()
  if (!user_name?.trim()) return NextResponse.json({ error: 'user_name required' }, { status: 400 })

  const member = await addProjectMember({
    project_id: parseInt(params.id, 10),
    user_name:  user_name.trim(),
    role:       role || 'member',
  })
  return NextResponse.json(member)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_name } = await req.json()
  if (!user_name) return NextResponse.json({ error: 'user_name required' }, { status: 400 })

  await removeProjectMember(parseInt(params.id, 10), user_name)
  return NextResponse.json({ ok: true })
}
