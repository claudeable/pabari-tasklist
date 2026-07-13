import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getInvoices } from '@/lib/finance'
import InvoiceBoard from '@/components/InvoiceBoard'

export const dynamic = 'force-dynamic'

const ALLOWED_NAMES = ['harshil', 'benson']

export default async function FinancePage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) redirect('/login')

  const isAllowed = currentUser.role === 'admin' ||
    ALLOWED_NAMES.includes(currentUser.name.toLowerCase().split(' ')[0])

  if (!isAllowed) redirect('/')

  const invoices = await getInvoices()

  return <InvoiceBoard initialInvoices={invoices} currentUser={currentUser} />
}
