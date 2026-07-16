import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// GET /api/connect/categories
export async function GET() {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rows = await query<{ id: number; name: string }>(
    `SELECT id, name FROM connect_categories ORDER BY name ASC`
  )
  return NextResponse.json(rows)
}

// POST /api/connect/categories — create a new category
export async function POST(req: NextRequest) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const rows = await query<{ id: number; name: string }>(
    `INSERT INTO connect_categories (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name`,
    [name.trim()]
  )
  return NextResponse.json(rows[0], { status: 201 })
}
