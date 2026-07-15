import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { queryOne, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const row = await queryOne(`SELECT * FROM delivery_notes WHERE id=$1`, [params.id])
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(row)
  } catch (e) {
    console.error('[delivery-notes GET id]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks } = body
    if (!note_number?.trim()) return NextResponse.json({ error: 'Delivery Note No is required' }, { status: 400 })
    await execute(
      `UPDATE delivery_notes SET note_number=$1, to_company=$2, order_no=$3, delivery_date=$4,
       vehicle_no=$5, driver_name=$6, driver_id=$7, items=$8, remarks=$9 WHERE id=$10`,
      [note_number.trim(), to_company, order_no ?? '', delivery_date, vehicle_no ?? '', driver_name ?? '', driver_id ?? '', JSON.stringify(items ?? []), remarks ?? '', params.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[delivery-notes PUT]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { cancel_reason } = await req.json()
    await execute(
      `UPDATE delivery_notes SET status='cancelled', cancel_reason=$1 WHERE id=$2`,
      [cancel_reason ?? '', params.id]
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[delivery-notes PATCH]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    await execute(`DELETE FROM delivery_notes WHERE id=$1`, [params.id])
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[delivery-notes DELETE]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
