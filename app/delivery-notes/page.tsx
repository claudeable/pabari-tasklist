import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import DeliveryNotesList from '@/components/DeliveryNotesList'

export const dynamic = 'force-dynamic'

const ALLOWED_NAMES  = ['harshil', 'benson']
const ALLOWED_EMAILS = ['rkrishnan@usm.co.ke', 'yaynalem@usm.co.ke']

export default async function DeliveryNotesPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  const allowed = user.role === 'admin' ||
    ALLOWED_NAMES.includes(user.name.toLowerCase().split(' ')[0]) ||
    ALLOWED_EMAILS.includes(user.email)

  if (!allowed) redirect('/')
  return <DeliveryNotesList currentUser={user} />
}
