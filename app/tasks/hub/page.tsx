import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import TaskManagementHub from '@/components/TaskManagementHub'

export const dynamic = 'force-dynamic'

const INTEL_EMAILS  = ['bnzuka@usm.co.ke', 'pmureithi@usm.co.ke']
const INTEL_NAMES   = ['benson']
const YALELET_EMAIL = 'yaynalem@usm.co.ke'
const PAUL_EMAILS   = ['pmureithi@usm.co.ke', 'hkotecha@kwale-group.com']

export default async function TasksHubPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null
  if (!tokenUser) redirect('/login')

  const dbUser = await getUserByEmail(tokenUser.email)
  const currentUser = dbUser
    ? { ...tokenUser, companies: dbUser.companies, reports_to: dbUser.reports_to, hod_email: dbUser.hod_email }
    : tokenUser

  const email     = currentUser.email.toLowerCase()
  const firstName = currentUser.name.toLowerCase().split(' ')[0]
  const isAdmin   = currentUser.role === 'admin'

  // Benson → land directly on Intelligence
  if (INTEL_NAMES.includes(firstName)) redirect('/intelligence')

  // Everyone without special access → straight to task board
  const hasPaulAccess   = PAUL_EMAILS.includes(email)
  const hasYalelAccess  = email === YALELET_EMAIL
  if (!isAdmin && !hasPaulAccess && !hasYalelAccess) redirect('/tasks')

  // Paul/Harshil, Yalelet, Admin → show hub with their specific modules
  const userType = isAdmin ? 'admin' : hasPaulAccess ? 'paul' : 'yalelet'

  return <TaskManagementHub currentUser={currentUser} userType={userType} />
}
