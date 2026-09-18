import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail } from '@/lib/users'
import UnifiedHub from '@/components/UnifiedHub'

export const dynamic = 'force-dynamic'

export default async function DubaiPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const tokenUser = session?.value ? await verifyToken(session.value) : null
  if (!tokenUser) redirect('/login')

  const dbUser = await getUserByEmail(tokenUser.email).catch(() => null)
  const currentUser = dbUser
    ? { ...tokenUser, portals: dbUser.portals, companies: dbUser.companies }
    : tokenUser

  return <UnifiedHub currentUser={currentUser} mustChangePassword={dbUser?.must_change_password ?? false} branch="dubai" />
}
