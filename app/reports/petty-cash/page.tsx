import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import PettyCashReport from '@/components/PettyCashReport'

export const dynamic = 'force-dynamic'

export default async function PettyCashReportPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) redirect('/login')

  return <PettyCashReport currentUser={currentUser} />
}
