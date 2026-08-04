import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import TaskManagementHub from '@/components/TaskManagementHub'

export const dynamic = 'force-dynamic'

export default async function TasksHubPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null
  if (!tokenUser) redirect('/login')

  const dbUser = await getUserByEmail(tokenUser.email)
  const currentUser = dbUser
    ? { ...tokenUser, companies: dbUser.companies, reports_to: dbUser.reports_to, hod_email: dbUser.hod_email }
    : tokenUser

  // Regular users with only task access go straight to the board
  const isHK    = currentUser.name.toLowerCase().split(' ')[0] === 'harshil'
  const isAdmin = currentUser.role === 'admin'
  if (!isHK && !isAdmin) redirect('/tasks')

  return <TaskManagementHub currentUser={currentUser} />
}
