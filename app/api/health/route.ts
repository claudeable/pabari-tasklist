import { NextResponse } from 'next/server'
import { queryOne } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await queryOne('SELECT 1')
    return NextResponse.json({ ok: true, db: 'connected', ts: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 503 })
  }
}
