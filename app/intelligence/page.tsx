// ============================================================
// PABARI ERP — Intelligence / Executive Dashboard
// Only admin, director, CEO roles can reach this page.
// This is the former "/" page for executives, now at /intelligence
// so the main "/" shows the UnifiedHub for everyone.
// ============================================================
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import ExecutivePortal from '@/components/ExecutivePortal'

export const dynamic = 'force-dynamic'

export default async function IntelligencePage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')

  const allowed = ['admin', 'director', 'ceo', 'manager']
  if (!allowed.includes(currentUser.role)) redirect('/')

  return <ExecutivePortal currentUser={currentUser} />
}
