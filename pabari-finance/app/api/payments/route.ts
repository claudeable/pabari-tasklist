import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getPayments, createPayment } from '@/lib/db'

async function auth(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const payments = await getPayments({
    company: searchParams.get('company') || undefined,
    status:  searchParams.get('status')  || undefined,
  })
  return NextResponse.json({ payments })
}

export async function POST(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const required = ['company', 'counterpart', 'amount', 'payment_date', 'method', 'status']
  for (const f of required) {
    if (!body[f] && body[f] !== 0) return NextResponse.json({ error: `Missing: ${f}` }, { status: 400 })
  }

  const payment = await createPayment({ ...body, created_by: user.email })
  return NextResponse.json({ payment }, { status: 201 })
}
