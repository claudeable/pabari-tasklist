import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import PortalHub from '@/components/PortalHub'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')

  return <PortalHub currentUser={currentUser} />
}
