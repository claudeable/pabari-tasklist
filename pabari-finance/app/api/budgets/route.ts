import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getBudgets, upsertBudget } from '@/lib/db'

async function auth(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const budgets = await getBudgets({
    company: searchParams.get('company') || undefined,
    period:  searchParams.get('period')  || undefined,
  })
  return NextResponse.json({ budgets })
}

export async function POST(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const required = ['company', 'category', 'period', 'budgeted']
  for (const f of required) {
    if (!body[f] && body[f] !== 0) return NextResponse.json({ error: `Missing: ${f}` }, { status: 400 })
  }

  const budget = await upsertBudget({
    company:    body.company,
    category:   body.category,
    period:     body.period,
    budgeted:   Number(body.budgeted),
    spent:      Number(body.spent ?? 0),
    currency:   body.currency ?? 'KES',
    notes:      body.notes ?? '',
    created_by: user.email,
  })
  return NextResponse.json({ budget }, { status: 201 })
}
