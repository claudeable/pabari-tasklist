import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

// GET — preview: count how many tasks would be archived
export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const cutoff = req.nextUrl.searchParams.get('cutoff') || '2026-06-01'

  const rows = await query<{ count: string; priority: string }>(
    `SELECT priority, COUNT(*)::text AS count
     FROM tasks
     WHERE created_at < $1
       AND status NOT IN ('resolved', 'expired', 'archived')
       AND priority NOT IN ('high', 'critical')
     GROUP BY priority
     ORDER BY priority`,
    [cutoff]
  )

  const highRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tasks
     WHERE created_at < $1
       AND status NOT IN ('resolved', 'expired', 'archived')
       AND priority IN ('high', 'critical')`,
    [cutoff]
  )

  const total = rows.reduce((s, r) => s + parseInt(r.count), 0)

  return NextResponse.json({
    cutoff,
    toArchive: total,
    breakdown: rows,
    highPriorityKept: parseInt(highRows[0]?.count ?? '0', 10),
  })
}

// POST — execute the bulk archive
export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body   = await req.json()
  const cutoff = body.cutoff || '2026-06-01'

  await execute(
    `UPDATE tasks
     SET status = 'archived', updated_at = NOW()
     WHERE created_at < $1
       AND status NOT IN ('resolved', 'expired', 'archived')
       AND priority NOT IN ('high', 'critical')`,
    [cutoff]
  )

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tasks WHERE status = 'archived' AND updated_at >= NOW() - INTERVAL '5 seconds'`
  )

  return NextResponse.json({ ok: true, archived: parseInt(countRows[0]?.count ?? '0', 10) })
}
