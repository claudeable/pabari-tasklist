import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import PabariCentre from '@/components/PabariCentre'

export const dynamic = 'force-dynamic'

export default async function CentrePage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) redirect('/login')
  return <PabariCentre currentUser={currentUser} />
}
