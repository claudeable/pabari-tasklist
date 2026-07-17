import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// GET /api/connect/contacts/[id]
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await query<{ id: number }>(
    `SELECT c.*, co.name AS company_name,
       ARRAY_AGG(DISTINCT cat.name) FILTER (WHERE cat.name IS NOT NULL) AS categories
     FROM connect_contacts c
     LEFT JOIN connect_companies co ON co.id = c.company_id
     LEFT JOIN connect_contact_categories cc ON cc.contact_id = c.id
     LEFT JOIN connect_categories cat ON cat.id = cc.category_id
     WHERE c.id = $1
     GROUP BY c.id, co.name`,
    [params.id]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(rows[0])
}

// PUT /api/connect/contacts/[id] — full update
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fullName, companyName, position, phone, email, country, address, categoryNames, contactType } = body
  const isCompany = contactType === 'company'

  if (!isCompany && !fullName?.trim()) return NextResponse.json({ error: 'fullName is required' }, { status: 400 })
  if (isCompany && !companyName?.trim()) return NextResponse.json({ error: 'companyName is required for company contacts' }, { status: 400 })

  // Upsert company
  let companyId: number | null = null
  if (companyName?.trim()) {
    const rows = await query<{ id: number }>(
      `INSERT INTO connect_companies (name, country)
       VALUES ($1, $2)
       ON CONFLICT (LOWER(name)) DO UPDATE SET updated_at = now()
       RETURNING id`,
      [companyName.trim(), country ?? null]
    )
    companyId = rows[0].id
  }

  const effectiveName = isCompany ? (companyName?.trim() ?? '') : fullName.trim()

  await execute(
    `UPDATE connect_contacts SET
       full_name = $1, company_id = $2, position = $3,
       phone = $4, email = $5, country = $6, address = $7,
       contact_type = $8, updated_at = now()
     WHERE id = $9`,
    [effectiveName, companyId, position ?? null, phone ?? null, email ?? null, country ?? null, address ?? null, isCompany ? 'company' : 'person', params.id]
  )

  // Sync categories
  if (Array.isArray(categoryNames)) {
    await execute(`DELETE FROM connect_contact_categories WHERE contact_id = $1`, [params.id])
    for (const name of categoryNames) {
      if (!name?.trim()) continue
      const catRows = await query<{ id: number }>(
        `INSERT INTO connect_categories (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [name.trim()]
      )
      await execute(
        `INSERT INTO connect_contact_categories (contact_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [params.id, catRows[0].id]
      )
    }
  }

  return NextResponse.json({ ok: true })
}

// PATCH /api/connect/contacts/[id] — update categories only
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { categoryNames } = await req.json()
  if (!Array.isArray(categoryNames)) return NextResponse.json({ error: 'categoryNames must be an array' }, { status: 400 })

  await execute(`DELETE FROM connect_contact_categories WHERE contact_id = $1`, [params.id])
  for (const name of categoryNames) {
    if (!name?.trim()) continue
    const catRows = await query<{ id: number }>(
      `INSERT INTO connect_categories (name) VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [name.trim()]
    )
    await execute(
      `INSERT INTO connect_contact_categories (contact_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [params.id, catRows[0].id]
    )
  }

  return NextResponse.json({ ok: true })
}

// DELETE /api/connect/contacts/[id]
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await execute(`DELETE FROM connect_contacts WHERE id = $1`, [params.id])
  return NextResponse.json({ ok: true })
}
