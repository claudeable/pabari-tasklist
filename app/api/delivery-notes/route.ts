import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS delivery_notes (
      id          SERIAL PRIMARY KEY,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Add columns individually so existing tables are upgraded safely
  const cols: [string, string][] = [
    ['note_number',      'TEXT NOT NULL DEFAULT \'\''],
    ['to_company',       'TEXT NOT NULL DEFAULT \'\''],
    ['order_no',         'TEXT DEFAULT \'\''],
    ['delivery_date',    'TEXT NOT NULL DEFAULT \'\''],
    ['vehicle_no',       'TEXT DEFAULT \'\''],
    ['driver_name',      'TEXT DEFAULT \'\''],
    ['driver_id',        'TEXT DEFAULT \'\''],
    ['items',            'JSONB NOT NULL DEFAULT \'[]\''],
    ['remarks',          'TEXT DEFAULT \'\''],
    ['created_by',       'TEXT DEFAULT \'\''],
    ['status',           'TEXT NOT NULL DEFAULT \'active\''],
    ['cancel_reason',    'TEXT DEFAULT \'\''],
    ['issuing_company',  'TEXT NOT NULL DEFAULT \'mercury\''],
    ['gate_pass_number', 'TEXT DEFAULT \'\''],
  ]
  for (const [col, def] of cols) {
    await execute(`ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS ${col} ${def}`).catch(() => {})
  }
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureTable()
    const rows = await query(
      `SELECT id, note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks, status, cancel_reason, created_by, created_at, issuing_company, gate_pass_number
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
    const { note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks, issuing_company, gate_pass_number } = body

    if (!to_company || !delivery_date) {
      return NextResponse.json({ error: 'To Company and Date are required' }, { status: 400 })
    }
    if (!note_number?.trim()) {
      return NextResponse.json({ error: 'Delivery Note No is required' }, { status: 400 })
    }

    const rows = await query<{ id: number }>(
      `INSERT INTO delivery_notes (note_number, to_company, order_no, delivery_date, vehicle_no, driver_name, driver_id, items, remarks, created_by, issuing_company, gate_pass_number)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [note_number.trim(), to_company, order_no ?? '', delivery_date, vehicle_no ?? '', driver_name ?? '', driver_id ?? '', JSON.stringify(items ?? []), remarks ?? '', user.name, issuing_company ?? 'mercury', gate_pass_number ?? '']
    )
    const id = rows[0].id
    return NextResponse.json({ id, note_number: note_number.trim() })
  } catch (e) {
    console.error('[delivery-notes POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
