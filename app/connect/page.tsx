import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import ConnectDirectory from '@/components/ConnectDirectory'

export const dynamic = 'force-dynamic'

export default async function ConnectPage() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')
  return <ConnectDirectory currentUser={user} />
}
