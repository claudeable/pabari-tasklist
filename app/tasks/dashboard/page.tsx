import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import { getTasks } from '@/lib/db'
import TaskDashboard, { type DashboardTask, type DashboardCounts } from '@/components/TaskDashboard'
import type { Task, SessionUser } from '@/types'

export const dynamic = 'force-dynamic'

/* ── date helpers ── */
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function endOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 0 : 7 - day // Sunday
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

/* ── name matching ── */
function isUserTask(task: Task, user: SessionUser): boolean {
  const fullLower  = user.name.toLowerCase().trim()
  const firstLower = fullLower.split(' ')[0]

  const respParts = task.responsible.toLowerCase().split(/\s*[&/]\s*/).map(n => n.trim())
  if (respParts.some(n =>
    n === fullLower ||
    n === firstLower ||
    fullLower.startsWith(n + ' ')
  )) return true

  const co = task.co_assignees ?? []
  return co.some(n => {
    const nl = n.toLowerCase().trim()
    return nl === fullLower || nl === firstLower || fullLower.startsWith(nl + ' ')
  })
}

/* ── attention scoring ── */
const WAITING_STATUSES = new Set([
  'pending-discussion',
  'in-review',
  'awaiting-hod-approval',
  'awaiting-hk-approval',
])

const DONE_STATUSES = new Set(['resolved', 'expired', 'archived'])

function attentionScore(task: Task, today: string): number {
  if (DONE_STATUSES.has(task.status)) return -1
  let score = 0
  if (task.due_date && task.due_date < today) {
    const daysOver = Math.floor(
      (new Date(today).getTime() - new Date(task.due_date).getTime()) / 86_400_000
    )
    score += 1000 + daysOver * 10
  }
  if (task.due_date === today)           score += 800
  if (task.status === 'action-required') score += 700
  if (task.priority === 'high')          score += 300
  return score
}

/* ── serialise ── */
function toDTO(task: Task): DashboardTask {
  const updates = task.task_updates ?? []
  const latest  = updates.length > 0
    ? [...updates].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
    : null
  return {
    id:           task.id,
    particulars:  task.particulars,
    company:      task.company,
    section:      task.section,
    category:     task.category,
    priority:     task.priority,
    status:       task.status,
    due_date:     task.due_date,
    updated_at:   task.updated_at,
    latestUpdate: latest?.text?.slice(0, 100) ?? '',
  }
}

/* ── page ── */
export default async function TaskDashboardPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null

  if (!tokenUser) redirect('/login')

  const dbUser     = await getUserByEmail(tokenUser.email)
  const portals: string[] = dbUser?.portals ?? []
  const hasAccess  = tokenUser.role === 'admin' || portals.length === 0 || portals.includes('tasks')
  if (!hasAccess) redirect('/')

  const currentUser: SessionUser = dbUser
    ? { ...tokenUser, companies: dbUser.companies, reports_to: dbUser.reports_to, hod_email: dbUser.hod_email }
    : tokenUser

  const allTasks = await getTasks()
  const myTasks  = allTasks.filter(t => isUserTask(t, currentUser))

  const today     = todayISO()
  const weekStart = startOfWeekISO()
  const weekEnd   = endOfWeekISO()

  const activeTasks = myTasks.filter(t => !DONE_STATUSES.has(t.status))

  const counts: DashboardCounts = {
    active:           activeTasks.length,
    dueToday:         activeTasks.filter(t => t.due_date === today).length,
    dueThisWeek:      activeTasks.filter(t => t.due_date >= today && t.due_date <= weekEnd).length,
    waiting:          activeTasks.filter(t => WAITING_STATUSES.has(t.status)).length,
    overdue:          activeTasks.filter(t => !!t.due_date && t.due_date < today).length,
    completedThisWeek: myTasks.filter(t =>
      t.status === 'resolved' &&
      t.updated_at >= weekStart
    ).length,
  }

  const attentionTasks = activeTasks
    .map(t => ({ task: t, score: attentionScore(t, today) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ task }) => toDTO(task))

  const upcomingTasks = activeTasks
    .filter(t => t.due_date && t.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 7)
    .map(toDTO)

  const waitingTasks = activeTasks
    .filter(t => WAITING_STATUSES.has(t.status))
    .sort((a, b) => (a.due_date || 'z').localeCompare(b.due_date || 'z'))
    .slice(0, 5)
    .map(toDTO)

  const completedTasks = myTasks
    .filter(t => t.status === 'resolved' && t.updated_at >= weekStart)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 5)
    .map(toDTO)

  const canCreateTask =
    currentUser.role === 'admin' ||
    currentUser.role === 'director' ||
    currentUser.email === 'pmureithi@usm.co.ke' ||
    currentUser.email === 'yaynalem@usm.co.ke'

  return (
    <TaskDashboard
      user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}
      counts={counts}
      attentionTasks={attentionTasks}
      upcomingTasks={upcomingTasks}
      waitingTasks={waitingTasks}
      completedTasks={completedTasks}
      canCreateTask={canCreateTask}
      todayStr={today}
    />
  )
}
