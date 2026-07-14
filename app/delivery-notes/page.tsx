import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import DeliveryNotesList from '@/components/DeliveryNotesList'

export const dynamic = 'force-dynamic'

export default async function DeliveryNotesPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')
  return <DeliveryNotesList currentUser={user} />
}
