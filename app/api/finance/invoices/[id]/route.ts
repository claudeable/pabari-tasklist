import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getInvoiceById, updateInvoice, deleteInvoice } from '@/lib/finance'

const ALLOWED = ['harshil', 'benson']
function isAllowed(name: string, role: string) {
  if (role === 'admin') return true
  return ALLOWED.includes(name.toLowerCase().split(' ')[0])
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const inv = await getInvoiceById(Number(params.id))
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(inv)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    const inv  = await updateInvoice(Number(params.id), body)
    if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(inv)
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ok = await deleteInvoice(Number(params.id))
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
