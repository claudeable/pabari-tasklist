import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import DocumentManager from '@/components/DocumentManager'

export const dynamic = 'force-dynamic'

export default async function DocumentsPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')

  const canAccess =
    currentUser.role === 'admin' ||
    (currentUser.role === 'director' && currentUser.department === 'Director')

  if (!canAccess) redirect('/tasks')

  return <DocumentManager currentUser={currentUser} />
}
