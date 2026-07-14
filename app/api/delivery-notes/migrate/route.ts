import { NextResponse } from 'next/server'
import { execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await execute(`
      CREATE TABLE IF NOT EXISTS delivery_notes (
        id            SERIAL PRIMARY KEY,
        note_number   TEXT NOT NULL,
        to_company    TEXT NOT NULL,
        order_no      TEXT,
        delivery_date TEXT NOT NULL,
        vehicle_no    TEXT,
        driver_name   TEXT,
        driver_id     TEXT,
        items         JSONB NOT NULL DEFAULT '[]',
        remarks       TEXT,
        created_by    TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
