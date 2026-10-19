import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import CoreShell from '@/components/core/CoreShell'
import { canAccessCore } from '@/lib/core-access'

export const dynamic = 'force-dynamic'

export default async function CoreLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null
  if (!tokenUser) redirect('/login')

  const dbUser      = await getUserByEmail(tokenUser.email).catch(() => null)
  const currentUser = dbUser
    ? { ...tokenUser, email: dbUser.email, role: dbUser.role, portals: dbUser.portals, companies: dbUser.companies }
    : tokenUser

  const branch = cookieStore.get('pabari-branch')?.value || 'kenya'
  if (!canAccessCore(currentUser, branch)) redirect('/kenya')

  return <CoreShell currentUser={currentUser}>{children}</CoreShell>
}
