import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import { FINANCE_VISIBLE_EMAILS } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin    = user.role === 'admin'
  const isDirector = user.role === 'director' || user.role === 'ceo'
  const canFinance = isAdmin || isDirector || FINANCE_VISIBLE_EMAILS.has(user.email ?? '')

  const safe = (rows: { count: string }[]) => parseInt(rows[0]?.count ?? '0', 10)

  const [tasks, finance, projects, docs, invoices, deliveries] = await Promise.all([
    // Tasks: open tasks visible to the user
    query<{ count: string }>(
      isAdmin || isDirector
        ? `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired','archived')`
        : `SELECT COUNT(*)::text AS count FROM tasks WHERE status NOT IN ('resolved','expired','archived') AND responsible ILIKE $1`,
      isAdmin || isDirector ? [] : [`%${(user.name ?? '').split(' ')[0]}%`]
    ).catch(() => []),

    // Finance: active invoices
    canFinance
      ? query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM invoices WHERE status NOT IN ('paid','cancelled')`).catch(() => [])
      : Promise.resolve([{ count: '0' }]),

    // Projects: active projects
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM projects WHERE status IN ('active','planning')`).catch(() => []),

    // Documents
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM documents`).catch(() => []),

    // Invoices total (for finance card subtitle)
    canFinance
      ? query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM invoices`).catch(() => [])
      : Promise.resolve([{ count: '0' }]),

    // Delivery notes this week
    canFinance
      ? query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM delivery_notes WHERE created_at >= NOW() - INTERVAL '7 days'`).catch(() => [])
      : Promise.resolve([{ count: '0' }]),
  ])

  return NextResponse.json({
    tasks:      safe(tasks as { count: string }[]),
    finance:    safe(finance as { count: string }[]),
    projects:   safe(projects as { count: string }[]),
    docs:       safe(docs as { count: string }[]),
    invoices:   safe(invoices as { count: string }[]),
    deliveries: safe(deliveries as { count: string }[]),
  })
}
