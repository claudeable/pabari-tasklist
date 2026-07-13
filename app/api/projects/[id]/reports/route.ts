import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getStatusReports, createStatusReport, deleteStatusReport } from '@/lib/projects'
import { RAGStatus } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const reports = await getStatusReports(parseInt(params.id, 10))
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { rag, narrative, blockers, next_steps } = await req.json()
  if (!narrative?.trim()) return NextResponse.json({ error: 'narrative required' }, { status: 400 })

  const report = await createStatusReport({
    project_id: parseInt(params.id, 10),
    author:     user.name,
    rag:        (rag || 'not-set') as RAGStatus,
    narrative:  narrative.trim(),
    blockers:   blockers?.trim() || '',
    next_steps: next_steps?.trim() || '',
  })
  return NextResponse.json(report)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { report_id } = await req.json()
  if (!report_id) return NextResponse.json({ error: 'report_id required' }, { status: 400 })

  await deleteStatusReport(Number(report_id))
  return NextResponse.json({ ok: true })
}
