import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getPublicUsers } from '@/lib/users'
import { getTasks } from '@/lib/db'
import TaskBoard from '@/components/TaskBoard'

export const dynamic = 'force-dynamic'

export default async function TasksPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')

  const tasks = getTasks()
  const allUsers = getPublicUsers()

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
    />
  )
}
