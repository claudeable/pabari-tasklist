import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getFinanceTasks } from '@/lib/db'
import Nav from '@/components/Nav'
import FinanceTasksClient from './FinanceTasksClient'

export default async function TasksPage() {
  const token = (await cookies()).get('fin-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) redirect('/login')

  const tasks = await getFinanceTasks()
  return (
    <div className="layout">
      <Nav userName={user.name} userEmail={user.email} />
      <main className="main-content">
        <FinanceTasksClient tasks={tasks} />
      </main>
    </div>
  )
}
