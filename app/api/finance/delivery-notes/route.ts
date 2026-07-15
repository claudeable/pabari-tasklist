import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getDeliveryNotes, createDeliveryNote } from '@/lib/finance'

const ALLOWED_NAMES  = ['harshil', 'benson']
const ALLOWED_EMAILS = ['rkrishnan@usm.co.ke', 'yaynalem@usm.co.ke']
function isAllowed(name: string, role: string, email: string) {
  if (role === 'admin') return true
  if (ALLOWED_EMAILS.includes(email)) return true
  return ALLOWED_NAMES.includes(name.toLowerCase().split(' ')[0])
}

export async function GET(req: NextRequest) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role, currentUser.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const invId = req.nextUrl.searchParams.get('invoice_id')
  const notes = await getDeliveryNotes(invId ? Number(invId) : undefined)
  return NextResponse.json(notes)
}

export async function POST(req: NextRequest) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role, currentUser.email))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    if (!body.delivered_to) return NextResponse.json({ error: 'delivered_to required' }, { status: 400 })
    const dn = await createDeliveryNote({ ...body, created_by: currentUser.name })
    return NextResponse.json(dn, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
