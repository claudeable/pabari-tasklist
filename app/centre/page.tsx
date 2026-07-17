import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import PabariCentre from '@/components/PabariCentre'

export const dynamic = 'force-dynamic'

export default async function CentrePage({ searchParams }: { searchParams: Record<string, string> }) {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) redirect('/login')

  // Support ?tab=mail from OAuth callback redirect
  const validTabs = ['inbox', 'chat', 'ai', 'mail'] as const
  type Tab = typeof validTabs[number]
  const rawTab = searchParams.tab
  const initialTab: Tab = validTabs.includes(rawTab as Tab) ? rawTab as Tab : 'inbox'

  return <PabariCentre currentUser={currentUser} initialTab={initialTab} />
}
