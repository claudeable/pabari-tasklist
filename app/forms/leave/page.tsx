import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getAllLeaveRequests, getMyLeaveRequests, getLeaveBalance, ANNUAL_LEAVE_LIMIT } from '@/lib/leave'
import LeaveList from '@/components/LeaveList'

export const dynamic = 'force-dynamic'

export default async function LeaveFormPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  const year = new Date().getFullYear()
  const canSeeAll = user.role === 'admin' || user.role === 'director' || user.department === 'HR'

  const [requests, usedDays] = await Promise.all([
    canSeeAll ? getAllLeaveRequests() : getMyLeaveRequests(user.name, parseInt(String(user.id ?? ''), 10) || undefined),
    getLeaveBalance(user.name, year),
  ])

  return (
    <LeaveList
      currentUser={user}
      requests={requests}
      usedDays={usedDays}
      remaining={Math.max(0, ANNUAL_LEAVE_LIMIT - usedDays)}
    />
  )
}
