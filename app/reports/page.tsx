import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getReports } from '@/lib/reports'
import ReportsModule from '@/components/ReportsModule'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')
  if (currentUser.role === 'staff') redirect('/tasks')

  const reports = await getReports()

  return <ReportsModule currentUser={currentUser} initialReports={reports} />
}
