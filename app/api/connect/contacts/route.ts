import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// GET /api/connect/contacts?q=search&category=Banking&country=Kenya&page=1
export async function GET(req: NextRequest) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q        = searchParams.get('q')?.trim() ?? ''
  const category = searchParams.get('category')
  const country  = searchParams.get('country')
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = 50
  const offset   = (page - 1) * pageSize

  const conditions: string[] = []
  const params: unknown[] = []

  if (q) {
    const tsQuery = q.split(/\s+/).filter(Boolean).map(t => `${t}:*`).join(' & ')
    params.push(tsQuery)
    const tsIdx = params.length
    params.push(`%${q}%`)
    const likeIdx = params.length
    conditions.push(`(c.search_vector @@ to_tsquery('simple', $${tsIdx}) OR co.name ILIKE $${likeIdx})`)
  }
  if (category) {
    params.push(category)
    conditions.push(`EXISTS (
      SELECT 1 FROM connect_contact_categories cc
      JOIN connect_categories cat ON cat.id = cc.category_id
      WHERE cc.contact_id = c.id AND cat.name = $${params.length}
    )`)
  }
  if (country) {
    params.push(country)
    conditions.push(`c.country = $${params.length}`)
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  // Count query uses same filters but no pagination
  const countSql = `
    SELECT COUNT(DISTINCT c.id) AS total
    FROM connect_contacts c
    LEFT JOIN connect_companies co ON co.id = c.company_id
    ${whereClause}
  `

  params.push(pageSize, offset)

  const sql = `
    SELECT
      c.id, c.full_name, c.position, c.phone, c.email, c.country, c.address,
      c.needs_review, c.duplicate_group, c.card_front_image_url, c.card_back_image_url,
      co.id AS company_id, co.name AS company_name,
      ARRAY_AGG(DISTINCT cat.name) FILTER (WHERE cat.name IS NOT NULL) AS categories
    FROM connect_contacts c
    LEFT JOIN connect_companies co ON co.id = c.company_id
    LEFT JOIN connect_contact_categories cc ON cc.contact_id = c.id
    LEFT JOIN connect_categories cat ON cat.id = cc.category_id
    ${whereClause}
    GROUP BY c.id, co.id
    ORDER BY c.full_name ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `

  try {
    const filterParams = params.slice(0, params.length - 2)
    const [countRows, contacts] = await Promise.all([
      query<{ total: string }>(countSql, filterParams),
      query(sql, params),
    ])
    const total = parseInt(countRows[0]?.total ?? '0', 10)
    return NextResponse.json({ contacts, page, pageSize, total })
  } catch (e) {
    console.error('[connect/contacts GET]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/connect/contacts — create a contact manually
export async function POST(req: NextRequest) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { fullName, companyName, position, phone, email, country, address, categoryNames } = body

  if (!fullName?.trim()) {
    return NextResponse.json({ error: 'fullName is required' }, { status: 400 })
  }

  try {
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

    const rows = await query<{ id: number }>(
      `INSERT INTO connect_contacts
         (company_id, full_name, position, phone, email, country, address, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manual')
       RETURNING id`,
      [companyId, fullName.trim(), position ?? null, phone ?? null, email ?? null, country ?? null, address ?? null]
    )
    const contactId = rows[0].id

    // Assign categories
    if (Array.isArray(categoryNames)) {
      for (const name of categoryNames) {
        if (!name?.trim()) continue
        const catRows = await query<{ id: number }>(
          `INSERT INTO connect_categories (name) VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
          [name.trim()]
        )
        await execute(
          `INSERT INTO connect_contact_categories (contact_id, category_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [contactId, catRows[0].id]
        )
      }
    }

    return NextResponse.json({ id: contactId }, { status: 201 })
  } catch (e) {
    console.error('[connect/contacts POST]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
