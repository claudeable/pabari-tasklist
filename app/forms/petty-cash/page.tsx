import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getAllPettyCashRequests, getMyPettyCashRequests } from '@/lib/pettyCash'
import PettyCashList from '@/components/PettyCashList'

export const dynamic = 'force-dynamic'

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'
const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const SABINA_EMAIL  = 'smutua@kwale-group.com'

export default async function PettyCashPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  const canSeeAll = user.role === 'admin' || user.role === 'director'
    || user.email === HOS_EMAIL || user.email === FINANCE_EMAIL
    || user.email === SABINA_EMAIL

  const uid = parseInt(String(user.id ?? ''), 10) || 0
  const requests = canSeeAll
    ? await getAllPettyCashRequests()
    : await getMyPettyCashRequests(uid)

  return <PettyCashList currentUser={user} requests={requests} />
}
