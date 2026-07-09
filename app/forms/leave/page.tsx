import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getAllLeaveRequests, getMyLeaveRequests, getLeaveBalance, ANNUAL_LEAVE_LIMIT } from '@/lib/leave'
import type { LeaveRequest } from '@/lib/leave'
import LeaveList from '@/components/LeaveList'

export const dynamic = 'force-dynamic'

export default async function LeaveFormPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  const year = new Date().getFullYear()
  const canSeeAll = user.role === 'admin' || user.role === 'director' || user.department === 'HR'
  const empId = parseInt(String(user.id ?? ''), 10) || undefined

  console.log('[leave page] user=%s id=%s role=%s dept=%s canSeeAll=%s', user.name, user.id, user.role, user.department, canSeeAll)
  let requests: LeaveRequest[] = []
  let usedDays = 0
  try {
    const results = await Promise.all([
      canSeeAll ? getAllLeaveRequests() : getMyLeaveRequests(user.name, empId),
      getLeaveBalance(user.name, year),
    ])
    requests = results[0]
    usedDays = results[1]
    console.log('[leave page] requests=%d usedDays=%d', requests.length, usedDays)
  } catch (err) {
    console.error('[leave page] ERROR', err)
  }

  return (
    <LeaveList
      currentUser={user}
      requests={requests}
      usedDays={usedDays}
      remaining={Math.max(0, ANNUAL_LEAVE_LIMIT - usedDays)}
    />
  )
}
