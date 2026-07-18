import { NextRequest, NextResponse } from 'next/server';
// Adjust this import to match however pabari-tasklist currently connects to Postgres
// (e.g. a shared `lib/db.ts` pool, or Prisma client). This assumes a shared `pg` Pool
// exported as `db`.
import { db } from '@/lib/db';

// GET /api/connect/contacts?q=search+term&category=Banking&country=Kenya&page=1
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const category = searchParams.get('category');
  const country = searchParams.get('country');
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const pageSize = 50;
  const offset = (page - 1) * pageSize;

  const conditions: string[] = [];
  const params: any[] = [];

  if (q) {
    params.push(
      q
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => `${t}:*`)
        .join(' & ')
    );
    conditions.push(`c.search_vector @@ to_tsquery('simple', $${params.length})`);
  }
  if (category) {
    params.push(category);
    conditions.push(`EXISTS (
      SELECT 1 FROM connect_contact_categories cc
      JOIN connect_categories cat ON cat.id = cc.category_id
      WHERE cc.contact_id = c.id AND cat.name = $${params.length}
    )`);
  }
  if (country) {
    params.push(country);
    conditions.push(`c.country = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(pageSize, offset);

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
  `;

  try {
    const { rows } = await db.query(sql, params);
    return NextResponse.json({ contacts: rows, page, pageSize });
  } catch (err) {
    console.error('Connect contacts query failed:', err);
    return NextResponse.json({ error: 'Failed to load contacts' }, { status: 500 });
  }
}

// POST /api/connect/contacts — create a contact (manual entry)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { fullName, companyName, position, phone, email, country, address } = body;

  if (!fullName) {
    return NextResponse.json({ error: 'fullName is required' }, { status: 400 });
  }

  try {
    let companyId: number | null = null;
    if (companyName) {
      const companyResult = await db.query(
        `INSERT INTO connect_companies (name, country)
         VALUES ($1, $2)
         ON CONFLICT (LOWER(name)) DO UPDATE SET updated_at = now()
         RETURNING id`,
        [companyName, country || null]
      );
      companyId = companyResult.rows[0].id;
    }

    const { rows } = await db.query(
      `INSERT INTO connect_contacts
         (company_id, full_name, position, phone, email, country, address, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'manual')
       RETURNING id`,
      [companyId, fullName, position || null, phone || null, email || null, country || null, address || null]
    );

    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('Failed to create contact:', err);
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}
