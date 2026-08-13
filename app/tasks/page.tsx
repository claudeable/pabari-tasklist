import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getPublicUsers, getSubordinates, getUserByEmail } from '@/lib/users'
import { getTasks } from '@/lib/db'
import { getManagerMembers } from '@/lib/managerMembers'
import TaskBoard from '@/components/TaskBoard'

export const dynamic = 'force-dynamic'

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null

  if (!tokenUser) redirect('/login')

  // Always hydrate companies/reports_to from DB so stale JWTs pick up changes
  const dbUser = await getUserByEmail(tokenUser.email)
  const currentUser = dbUser
    ? { ...tokenUser, companies: dbUser.companies, reports_to: dbUser.reports_to, hod_email: dbUser.hod_email }
    : tokenUser

  // Portal access guard: users with explicit portal assignments must have 'tasks' to enter Task Management
  const portals: string[] = dbUser?.portals ?? []
  const hasTasksAccess = currentUser.role === 'admin' || portals.length === 0 || portals.includes('tasks')
  if (!hasTasksAccess) redirect('/')

  // Redirect Pedro to his personal dashboard unless opening a specific task
  if (currentUser.email === 'hpedro@usm.co.ke' && !searchParams?.id) redirect('/tasks/dashboard')
  // Redirect Harshil to the Executive Intelligence dashboard
  const isHK = currentUser.name.toLowerCase().startsWith('harshil')
  if (isHK && !searchParams?.id) redirect('/intelligence')

  const [tasks, allUsers, subordinates, teamMembers] = await Promise.all([
    getTasks(),
    getPublicUsers(),
    getSubordinates(currentUser.email),
    currentUser.role === 'manager' ? getManagerMembers(currentUser.email) : Promise.resolve([]),
  ])

  const sorted = tasks.map(t => ({
    ...t,
    task_updates: [...(t.task_updates || [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
  }))

  return (
    <TaskBoard
      initialTasks={sorted}
      currentUser={currentUser}
      allUsers={allUsers}
      subordinates={subordinates}
      teamMembers={teamMembers}
    />
  )
}
