// ============================================================
// PABARI ERP — Main portal hub (entry point for all users)
// Sub-portals: Smart Ops, PIL/KETRACO, Property Management
// Executive dashboard is at /intelligence
// ============================================================
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import UnifiedHub from '@/components/UnifiedHub'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')

  return <UnifiedHub currentUser={currentUser} />
}
