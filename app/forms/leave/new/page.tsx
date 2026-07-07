import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getLeaveBalance, ANNUAL_LEAVE_LIMIT } from '@/lib/leave'
import LeaveRequestForm from '@/components/LeaveRequestForm'

export const dynamic = 'force-dynamic'

export default async function NewLeaveFormPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  const year = new Date().getFullYear()

  let usedDays = 0
  try {
    usedDays = await getLeaveBalance(user.name, year)
  } catch (err) {
    console.error('[leave/new] getLeaveBalance error:', err)
  }

  return (
    <LeaveRequestForm
      currentUser={user}
      usedDays={usedDays}
      remaining={Math.max(0, ANNUAL_LEAVE_LIMIT - usedDays)}
    />
  )
}
