import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getInvoices, createInvoice } from '@/lib/db'

async function auth(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const invoices = await getInvoices({
    company: searchParams.get('company') || undefined,
    status:  searchParams.get('status')  || undefined,
    type:    searchParams.get('type')    || undefined,
  })
  return NextResponse.json({ invoices })
}

export async function POST(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const required = ['ref_no', 'type', 'company', 'counterpart', 'amount', 'issue_date', 'status']
  for (const f of required) {
    if (!body[f] && body[f] !== 0) return NextResponse.json({ error: `Missing: ${f}` }, { status: 400 })
  }

  const invoice = await createInvoice({ ...body, created_by: user.email })
  return NextResponse.json({ invoice }, { status: 201 })
}
