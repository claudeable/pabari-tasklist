import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getAllLeaveRequests } from '@/lib/leave'
import { getAllPettyCashRequests } from '@/lib/pettyCash'
import FormsReports from '@/components/FormsReports'

export const dynamic = 'force-dynamic'

export default async function FormsReportsPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/tasks')

  const [leaveReqs, pcrReqs] = await Promise.all([
    getAllLeaveRequests(),
    getAllPettyCashRequests(),
  ])

  return (
    <FormsReports
      currentUser={user}
      leaveReqs={leaveReqs}
      pcrReqs={pcrReqs}
      canSeeLeaveFull={true}
      canSeePCRFull={true}
    />
  )
}
