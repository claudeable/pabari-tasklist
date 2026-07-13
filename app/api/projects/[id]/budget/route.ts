import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectExpenses, createProjectExpense, deleteProjectExpense, getProjectPCRs, getProjectLPOs } from '@/lib/projects'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const projectId = parseInt(params.id, 10)
  const [expenses, pcrs, lpos] = await Promise.all([
    getProjectExpenses(projectId),
    getProjectPCRs(projectId),
    getProjectLPOs(projectId),
  ])
  return NextResponse.json({ expenses, pcrs, lpos })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { description, amount, expense_date, category } = await req.json()
  if (!description?.trim()) return NextResponse.json({ error: 'description required' }, { status: 400 })
  if (!amount || Number(amount) <= 0) return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 })

  const expense = await createProjectExpense({
    project_id:   parseInt(params.id, 10),
    description:  description.trim(),
    amount:       Number(amount),
    expense_date: expense_date || new Date().toISOString().slice(0, 10),
    category:     category || 'General',
    logged_by:    user.name,
  })
  return NextResponse.json(expense)
}

export async function DELETE(req: NextRequest, { params: _params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { expense_id } = await req.json()
  if (!expense_id) return NextResponse.json({ error: 'expense_id required' }, { status: 400 })
  await deleteProjectExpense(Number(expense_id))
  return NextResponse.json({ ok: true })
}
