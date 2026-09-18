import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getStatusReports, createStatusReport, deleteStatusReport } from '@/lib/projects'
import { RAGStatus } from '@/types'

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

  const reports = await getStatusReports(projectId)
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rag, narrative, blockers, next_steps } = await req.json()
  if (!narrative?.trim()) return NextResponse.json({ error: 'narrative required' }, { status: 400 })

  const report = await createStatusReport({
    project_id: projectId,
    author:     user.name,
    rag:        (rag || 'not-set') as RAGStatus,
    narrative:  narrative.trim(),
    blockers:   blockers?.trim() || '',
    next_steps: next_steps?.trim() || '',
  })
  return NextResponse.json(report)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const projectId = parseInt(params.id, 10)
  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  const { report_id } = await req.json()
  if (!report_id) return NextResponse.json({ error: 'report_id required' }, { status: 400 })

  await deleteStatusReport(Number(report_id))
  return NextResponse.json({ ok: true })
}
