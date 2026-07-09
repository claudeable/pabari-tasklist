import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import SecurityDashboard from '@/components/SecurityDashboard'

export const dynamic = 'force-dynamic'

export default async function SecurityPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  const isAdmin = user.role === 'admin' ||
    (user.role === 'director' && user.department === 'Director')
  if (!isAdmin) redirect('/')

  return <SecurityDashboard currentUser={user} />
}
