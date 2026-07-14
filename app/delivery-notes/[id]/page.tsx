import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import DeliveryNoteView from '@/components/DeliveryNoteView'

export const dynamic = 'force-dynamic'

export default async function DeliveryNoteViewPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')
  return <DeliveryNoteView id={params.id} currentUser={user} />
}
