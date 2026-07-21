import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS dn_customers (
      id           SERIAL PRIMARY KEY,
      name         TEXT NOT NULL,
      contact_person TEXT DEFAULT '',
      phone        TEXT DEFAULT '',
      address      TEXT DEFAULT '',
      created_by   TEXT DEFAULT '',
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)
}

async function getUser() {
  const token = cookies().get('pabari-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()
  const rows = await query(`SELECT * FROM dn_customers ORDER BY name ASC`)
  return NextResponse.json({ customers: rows })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()
  const { name, contact_person, phone, address } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const rows = await query<{ id: number }>(
    `INSERT INTO dn_customers (name, contact_person, phone, address, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [name.trim(), contact_person ?? '', phone ?? '', address ?? '', user.name]
  )
  const customer = { id: rows[0].id, name: name.trim(), contact_person: contact_person ?? '', phone: phone ?? '', address: address ?? '' }
  return NextResponse.json({ customer }, { status: 201 })
}
