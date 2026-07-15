import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getInvoices } from '@/lib/finance'
import InvoiceBoard from '@/components/InvoiceBoard'

export const dynamic = 'force-dynamic'

const ALLOWED_NAMES  = ['harshil', 'benson']
const ALLOWED_EMAILS = ['rkrishnan@usm.co.ke', 'yaynalem@usm.co.ke']

export default async function FinancePage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) redirect('/login')

  const isAllowed = currentUser.role === 'admin' ||
    ALLOWED_NAMES.includes(currentUser.name.toLowerCase().split(' ')[0]) ||
    ALLOWED_EMAILS.includes(currentUser.email)

  if (!isAllowed) redirect('/')

  const invoices = await getInvoices()

  return <InvoiceBoard initialInvoices={invoices} currentUser={currentUser} />
}
