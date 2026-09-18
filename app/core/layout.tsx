import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import CoreShell from '@/components/core/CoreShell'

export const dynamic = 'force-dynamic'

export default async function CoreLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const tokenUser   = session?.value ? await verifyToken(session.value) : null
  if (!tokenUser) redirect('/login')

  // Admin only for now
  if (tokenUser.role !== 'admin') redirect('/kenya')

  const dbUser      = await getUserByEmail(tokenUser.email).catch(() => null)
  const currentUser = dbUser
    ? { ...tokenUser, portals: dbUser.portals, companies: dbUser.companies }
    : tokenUser

  return <CoreShell currentUser={currentUser}>{children}</CoreShell>
}
