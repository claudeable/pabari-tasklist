import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import { getTasks } from '@/lib/db'
import TaskDashboard, { type DashboardTask, type DashboardCounts, type WeekDay } from '@/components/TaskDashboard'
import type { Task, SessionUser } from '@/types'

export const dynamic = 'force-dynamic'

/* ── Kenya time (UTC+3) ── */
const EAT = 3 * 60 * 60 * 1000

function kenyaNow(): Date {
  return new Date(Date.now() + EAT)
}

function todayISO(): string {
  return kenyaNow().toISOString().slice(0, 10)
}

function startOfWeekISO(today: string): string {
  const d = new Date(today + 'T12:00:00Z')
  const dow = d.getUTCDay()                   // 0 = Sun
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return d.toISOString().slice(0, 10)
}

function endOfWeekISO(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}

/** Normalise any timestamp string → Kenya YYYY-MM-DD */
function toKenyaDate(ts: string): string {
  if (!ts) return ''
  const d = new Date(ts)
  if (isNaN(d.getTime())) return ''
  return new Date(d.getTime() + EAT).toISOString().slice(0, 10)
}

/* ── status sets ── */
const DONE   = new Set(['resolved', 'expired', 'archived'])
const WAITING_ST = new Set(['pending-discussion', 'in-review', 'awaiting-hod-approval', 'awaiting-hk-approval'])

/* ── name matching ── */
function isUserTask(task: Task, user: SessionUser): boolean {
  const full  = user.name.toLowerCase().trim()
  const first = full.split(' ')[0]
  const parts = task.responsible.toLowerCase().split(/\s*[&/]\s*/).map(s => s.trim())
  if (parts.some(n => n === full || n === first || full.startsWith(n + ' '))) return true
  return (task.co_assignees ?? []).some(n => {
    const nl = n.toLowerCase().trim()
    return nl === full || nl === first || full.startsWith(nl + ' ')
  })
}

/* ── attention scoring ── */
function attentionScore(task: Task, today: string): number {
  if (DONE.has(task.status)) return -1
  let score = 0
  if (task.due_date && task.due_date < today) {
    const days = Math.floor((new Date(today).getTime() - new Date(task.due_date).getTime()) / 86_400_000)
    score += 1000 + days * 10
  }
  if (task.due_date === today)           score += 800
  if (task.status === 'action-required') score += 700
  if (task.priority === 'high')          score += 300
  return score
}

/* ── serialise ── */
function toDTO(task: Task): DashboardTask {
  const sorted = [...(task.task_updates ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
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
    latestUpdate: sorted[0]?.text?.slice(0, 120) ?? '',
  }
}

/* ── page ── */
export default async function TaskDashboardPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null
  if (!tokenUser) redirect('/login')

  const dbUser = await getUserByEmail(tokenUser.email)
  const portals: string[] = dbUser?.portals ?? []
  if (tokenUser.role !== 'admin' && portals.length > 0 && !portals.includes('tasks')) redirect('/')

  const currentUser: SessionUser = dbUser
    ? { ...tokenUser, companies: dbUser.companies, reports_to: dbUser.reports_to, hod_email: dbUser.hod_email }
    : tokenUser

  const allTasks = await getTasks()
  const myTasks  = allTasks.filter(t => isUserTask(t, currentUser))

  const today     = todayISO()
  const weekStart = startOfWeekISO(today)
  const weekEnd   = endOfWeekISO(weekStart)

  const active = myTasks.filter(t => !DONE.has(t.status))

  const counts: DashboardCounts = {
    active:            active.length,
    dueToday:          active.filter(t => t.due_date === today).length,
    dueThisWeek:       active.filter(t => !!t.due_date && t.due_date >= today && t.due_date <= weekEnd).length,
    waiting:           active.filter(t => WAITING_ST.has(t.status)).length,
    overdue:           active.filter(t => !!t.due_date && t.due_date < today).length,
    completedThisWeek: myTasks.filter(t =>
      t.status === 'resolved' && toKenyaDate(t.updated_at) >= weekStart
    ).length,
  }

  const attentionTasks = active
    .map(t => ({ task: t, score: attentionScore(t, today) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(x => toDTO(x.task))

  const upcomingTasks = active
    .filter(t => !!t.due_date && t.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 7)
    .map(toDTO)

  const waitingTasks = active
    .filter(t => WAITING_ST.has(t.status))
    .sort((a, b) => (a.due_date || 'z').localeCompare(b.due_date || 'z'))
    .slice(0, 5)
    .map(toDTO)

  const completedTasks = myTasks
    .filter(t => t.status === 'resolved' && toKenyaDate(t.updated_at) >= weekStart)
    .sort((a, b) => toKenyaDate(b.updated_at).localeCompare(toKenyaDate(a.updated_at)))
    .slice(0, 5)
    .map(toDTO)

  // Build Mon–Fri activity for the week panel
  const weekDays: WeekDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((label, i) => {
    const d = new Date(weekStart + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    const date = d.toISOString().slice(0, 10)
    return {
      date,
      label,
      dueCount:  active.filter(t => t.due_date === date).length,
      isToday:   date === today,
      isPast:    date < today,
    }
  })

  const canCreateTask =
    currentUser.role === 'admin' ||
    currentUser.role === 'director' ||
    currentUser.email === 'pmureithi@usm.co.ke' ||
    currentUser.email === 'yaynalem@usm.co.ke'

  const kenyaHour = kenyaNow().getUTCHours()

  return (
    <TaskDashboard
      user={{ name: currentUser.name, email: currentUser.email, role: currentUser.role }}
      counts={counts}
      attentionTasks={attentionTasks}
      upcomingTasks={upcomingTasks}
      waitingTasks={waitingTasks}
      completedTasks={completedTasks}
      weekDays={weekDays}
      weekSummary={{ completed: counts.completedThisWeek, active: counts.active, overdue: counts.overdue }}
      canCreateTask={canCreateTask}
      todayStr={today}
      kenyaHour={kenyaHour}
    />
  )
}
