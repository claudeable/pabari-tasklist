import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await query(
    `SELECT id, note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks, created_by, created_at
     FROM delivery_notes ORDER BY created_at DESC LIMIT 200`
  )
  return NextResponse.json({ notes: rows })
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks } = body

  if (!note_number || !to_company || !delivery_date) {
    return NextResponse.json({ error: 'note_number, to_company and delivery_date are required' }, { status: 400 })
  }

  const rows = await query<{ id: number }>(
    `INSERT INTO delivery_notes (note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [note_number, to_company, order_no ?? '', delivery_date, vehicle_no ?? '', driver_name ?? '', driver_id ?? '', JSON.stringify(items ?? []), remarks ?? '', user.name]
  )
  return NextResponse.json({ id: rows[0].id })
}
