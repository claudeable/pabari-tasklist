import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS delivery_notes (
      id            SERIAL PRIMARY KEY,
      note_number   TEXT NOT NULL,
      to_company    TEXT NOT NULL,
      order_no      TEXT DEFAULT '',
      delivery_date TEXT NOT NULL,
      vehicle_no    TEXT DEFAULT '',
      driver_name   TEXT DEFAULT '',
      driver_id     TEXT DEFAULT '',
      items         JSONB NOT NULL DEFAULT '[]',
      remarks       TEXT DEFAULT '',
      created_by    TEXT DEFAULT '',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureTable()
    const rows = await query(
      `SELECT id, note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks, created_by, created_at
       FROM delivery_notes ORDER BY created_at DESC LIMIT 200`
    )
    return NextResponse.json({ notes: rows })
  } catch (e) {
    console.error('[delivery-notes GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureTable()

    const body = await req.json()
    const { note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks } = body

    if (!note_number || !to_company || !delivery_date) {
      return NextResponse.json({ error: 'Delivery Note No, To Company and Date are required' }, { status: 400 })
    }

    const rows = await query<{ id: number }>(
      `INSERT INTO delivery_notes (note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [note_number, to_company, order_no ?? '', delivery_date, vehicle_no ?? '', driver_name ?? '', driver_id ?? '', JSON.stringify(items ?? []), remarks ?? '', user.name]
    )
    return NextResponse.json({ id: rows[0].id })
  } catch (e) {
    console.error('[delivery-notes POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
