import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import PortalHub from '@/components/PortalHub'
import ExecutivePortal from '@/components/ExecutivePortal'

export const dynamic = 'force-dynamic'

const EXEC_NAMES = ['harshil', 'benson']

export default async function Home() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')

  const firstName = (currentUser.name?.split(' ')[0] ?? '').toLowerCase()
  const isExec = currentUser.role === 'admin' || EXEC_NAMES.includes(firstName)

  return isExec
    ? <ExecutivePortal currentUser={currentUser} />
    : <PortalHub currentUser={currentUser} />
}
