import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { updatePayment, deletePayment } from '@/lib/db'

async function auth(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  return token ? verifyToken(token) : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const payment = await updatePayment(Number(params.id), body)
  if (!payment) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ payment })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ok = await deletePayment(Number(params.id))
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
