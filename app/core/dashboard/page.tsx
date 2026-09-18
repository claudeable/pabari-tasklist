import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import CoreDashboard from '@/components/core/CoreDashboard'

export const dynamic = 'force-dynamic'

export default async function CoreDashboardPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const user        = session?.value ? await verifyToken(session.value) : null
  const branch      = cookieStore.get('pabari-branch')?.value || 'kenya'

  const safe = (rows: { count: string }[]) => parseInt(rows[0]?.count ?? '0', 10)

  const [openTasks, activeTasks, resolvedTasks, projects, docs, users, recentActivity] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tasks WHERE branch = $1 AND status NOT IN ('resolved','expired','archived')`, [branch]).catch(() => []),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tasks WHERE branch = $1 AND status IN ('in-progress','in-review','awaiting-hk-approval','action-required')`, [branch]).catch(() => []),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM tasks WHERE branch = $1 AND status = 'resolved' AND updated_at >= NOW() - INTERVAL '30 days'`, [branch]).catch(() => []),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM projects WHERE branch = $1 AND status IN ('active','planning')`, [branch]).catch(() => []),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM documents`).catch(() => []),
    query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM users WHERE is_active = true`).catch(() => []),
    query<{ actor: string; description: string; created_at: string; action_type: string }>(
      `SELECT actor, description, created_at, action_type FROM activity_log ORDER BY created_at DESC LIMIT 8`
    ).catch(() => []),
  ])

  const stats = {
    openTasks:    safe(openTasks as { count: string }[]),
    activeTasks:  safe(activeTasks as { count: string }[]),
    resolvedTasks: safe(resolvedTasks as { count: string }[]),
    projects:     safe(projects as { count: string }[]),
    docs:         safe(docs as { count: string }[]),
    users:        safe(users as { count: string }[]),
  }

  return <CoreDashboard stats={stats} activity={recentActivity as { actor: string; description: string; created_at: string; action_type: string }[]} userName={user?.name ?? 'Admin'} />
}
