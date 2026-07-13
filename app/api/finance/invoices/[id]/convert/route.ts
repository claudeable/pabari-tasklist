import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { convertToInvoice } from '@/lib/finance'

const ALLOWED = ['harshil', 'benson']
function isAllowed(name: string, role: string) {
  if (role === 'admin') return true
  return ALLOWED.includes(name.toLowerCase().split(' ')[0])
}

export async function POST(_: NextRequest, { params }: { params: { id: string } }) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const invoice = await convertToInvoice(Number(params.id), currentUser.name)
    return NextResponse.json(invoice, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 })
  }
}
