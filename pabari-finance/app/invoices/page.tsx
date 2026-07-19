import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getInvoices } from '@/lib/db'
import Nav from '@/components/Nav'
import InvoicesClient from './InvoicesClient'

export default async function InvoicesPage() {
  const token = (await cookies()).get('fin-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) redirect('/login')

  const invoices = await getInvoices()
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Nav userName={user.name} />
      <main style={{ flex: 1, padding: '32px 36px' }}>
        <InvoicesClient invoices={invoices} userEmail={user.email} />
      </main>
    </div>
  )
}
