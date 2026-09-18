import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import PabariCoreBranches from '@/components/PabariCoreBranches'

export const dynamic = 'force-dynamic'

export default async function PabariCorePage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null
  if (!tokenUser) redirect('/login')

  const dbUser      = await getUserByEmail(tokenUser.email).catch(() => null)
  const currentUser = dbUser
    ? { ...tokenUser, portals: dbUser.portals, companies: dbUser.companies }
    : tokenUser

  const portals: string[] = dbUser?.portals ?? []
  const hasAccess = currentUser.role === 'admin' || portals.length === 0 || portals.includes('tasks')
  if (!hasAccess) redirect('/')

  return <PabariCoreBranches currentUser={currentUser} />
}
