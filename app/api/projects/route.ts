import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjects, createProject } from '@/lib/projects'
import { ProjectStatus } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projects = await getProjects()
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, description, company, owner, status, start_date, end_date, budget } = body
  if (!name?.trim() || !company) return NextResponse.json({ error: 'Name and company required' }, { status: 400 })

  const project = await createProject({
    name: name.trim(),
    description: description || '',
    company,
    owner: owner || user.name,
    status: (status || 'active') as ProjectStatus,
    start_date: start_date || '',
    end_date: end_date || '',
    budget: Number(budget) || 0,
    created_by: user.name,
  })
  return NextResponse.json(project)
}
