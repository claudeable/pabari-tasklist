import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getProjectMembers, addProjectMember, removeProjectMember, createProjectActivity } from '@/lib/projects'

export const dynamic = 'force-dynamic'

async function getAuthedUser(projectId: number) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') {
    const member = await getProjectMember(projectId, user.name)
    if (!member) return { user: null, err: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { user, err: null }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const members = await getProjectMembers(projectId)
  return NextResponse.json(members)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_name, role } = await req.json()
  if (!user_name?.trim()) return NextResponse.json({ error: 'user_name required' }, { status: 400 })

  const member = await addProjectMember({
    project_id: projectId,
    user_name:  user_name.trim(),
    role:       role || 'member',
  })
  createProjectActivity({
    project_id:  projectId,
    actor:       user.name,
    action_type: 'member.added',
    entity_type: 'member',
    description: `${user.name} added ${user_name.trim()} to the project`,
  }).catch(console.error)

  return NextResponse.json(member)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { user_name } = await req.json()
  if (!user_name) return NextResponse.json({ error: 'user_name required' }, { status: 400 })

  await removeProjectMember(projectId, user_name)
  createProjectActivity({
    project_id:  projectId,
    actor:       user.name,
    action_type: 'member.removed',
    entity_type: 'member',
    description: `${user.name} removed ${user_name} from the project`,
  }).catch(console.error)
  return NextResponse.json({ ok: true })
}
