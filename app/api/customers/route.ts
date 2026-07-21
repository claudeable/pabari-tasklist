import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

async function ensureTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS dn_customers (
      id               SERIAL PRIMARY KEY,
      name             TEXT NOT NULL,
      contact_person   TEXT DEFAULT '',
      phone            TEXT DEFAULT '',
      address          TEXT DEFAULT '',
      issuing_company  TEXT NOT NULL DEFAULT 'mercury',
      created_by       TEXT DEFAULT '',
      created_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await execute(`ALTER TABLE dn_customers ADD COLUMN IF NOT EXISTS issuing_company TEXT NOT NULL DEFAULT 'mercury'`).catch(() => {})
}

async function getUser() {
  const token = cookies().get('pabari-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()
  const co = req.nextUrl.searchParams.get('issuing_company')
  const rows = co
    ? await query(`SELECT * FROM dn_customers WHERE issuing_company=$1 ORDER BY name ASC`, [co])
    : await query(`SELECT * FROM dn_customers ORDER BY name ASC`)
  return NextResponse.json({ customers: rows })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await ensureTable()
  const { name, contact_person, phone, address, issuing_company } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const rows = await query<{ id: number }>(
    `INSERT INTO dn_customers (name, contact_person, phone, address, issuing_company, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
    [name.trim(), contact_person ?? '', phone ?? '', address ?? '', issuing_company ?? 'mercury', user.name]
  )
  const customer = { id: rows[0].id, name: name.trim(), contact_person: contact_person ?? '', phone: phone ?? '', address: address ?? '', issuing_company: issuing_company ?? 'mercury' }
  return NextResponse.json({ customer }, { status: 201 })
}
