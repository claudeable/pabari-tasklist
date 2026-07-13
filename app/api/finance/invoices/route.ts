import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getInvoices, createInvoice } from '@/lib/finance'
import type { DocType, InvoiceStatus } from '@/types'

const ALLOWED = ['harshil', 'benson']
function isAllowed(name: string, role: string) {
  if (role === 'admin') return true
  return ALLOWED.includes(name.toLowerCase().split(' ')[0])
}

export async function GET(req: NextRequest) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp      = req.nextUrl.searchParams
  const type    = sp.get('type')    as DocType | null
  const status  = sp.get('status')  as InvoiceStatus | null
  const company = sp.get('company') as string | null

  const invoices = await getInvoices({
    ...(type    ? { type }    : {}),
    ...(status  ? { status }  : {}),
    ...(company ? { company } : {}),
  })
  return NextResponse.json(invoices)
}

export async function POST(req: NextRequest) {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAllowed(currentUser.name, currentUser.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const body = await req.json()
    if (!body.issuing_company) return NextResponse.json({ error: 'issuing_company required' }, { status: 400 })
    if (!body.client_name)     return NextResponse.json({ error: 'client_name required' }, { status: 400 })
    if (!body.items?.length)   return NextResponse.json({ error: 'At least one line item required' }, { status: 400 })

    const invoice = await createInvoice({ ...body, created_by: currentUser.name })
    return NextResponse.json(invoice, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
