import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getProjectActivity } from '@/lib/projects'

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const url   = new URL(req.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500)
  const activity = await getProjectActivity(projectId, limit)
  return NextResponse.json(activity)
}
