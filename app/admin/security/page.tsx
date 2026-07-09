import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import SecurityDashboard from '@/components/SecurityDashboard'

export const dynamic = 'force-dynamic'

export default async function AdminSecurityPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  if (user.role !== 'admin') redirect('/')

  return <SecurityDashboard currentUser={user} />
}
