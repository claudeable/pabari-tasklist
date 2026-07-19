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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Nav userName={user.name} />
      <main style={{ flex: 1, padding: '32px 36px' }}>
        <FinanceTasksClient tasks={tasks} />
      </main>
    </div>
  )
}
