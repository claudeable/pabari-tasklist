import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getAllLeaveRequests, getMyLeaveRequests } from '@/lib/leave'
import { getAllPettyCashRequests, getMyPettyCashRequests } from '@/lib/pettyCash'
import FormsReports from '@/components/FormsReports'

export const dynamic = 'force-dynamic'

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'
const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const SURESH_EMAIL  = 'ssuresh@kwale-group.com'
const AHMAD_EMAIL   = 'ahmad@usm.co.ke'
const SABINA_EMAIL  = 'sabina@usc.co.ke'

export default async function FormsReportsPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  const isAdmin    = user.role === 'admin'
  const isDirector = user.role === 'director' || user.role === 'ceo'
  const isHR       = user.department === 'HR' || isAdmin

  // Leave reports: HR, admin, director
  const canSeeLeaveFull = isHR || isDirector

  // PCR reports: admin, director, all approvers, Sabina
  const isPCRApprover = [HOS_EMAIL, FINANCE_EMAIL, SURESH_EMAIL, AHMAD_EMAIL, SABINA_EMAIL]
    .includes((user.email ?? '').toLowerCase())
  const canSeePCRFull = isAdmin || isDirector || isPCRApprover

  if (!canSeeLeaveFull && !canSeePCRFull) redirect('/forms')

  const uid = parseInt(String(user.id ?? ''), 10) || 0

  const [leaveReqs, pcrReqs] = await Promise.all([
    canSeeLeaveFull ? getAllLeaveRequests() : getMyLeaveRequests(uid),
    canSeePCRFull   ? getAllPettyCashRequests() : getMyPettyCashRequests(uid),
  ])

  return (
    <FormsReports
      currentUser={user}
      leaveReqs={canSeeLeaveFull ? leaveReqs : []}
      pcrReqs={canSeePCRFull ? pcrReqs : []}
      canSeeLeaveFull={canSeeLeaveFull}
      canSeePCRFull={canSeePCRFull}
    />
  )
}
