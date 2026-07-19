import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getPayments } from '@/lib/db'
import Nav from '@/components/Nav'
import PaymentsClient from './PaymentsClient'

export default async function PaymentsPage() {
  const token = (await cookies()).get('fin-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) redirect('/login')

  const payments = await getPayments()
  return (
    <div className="layout">
      <Nav userName={user.name} userEmail={user.email} />
      <main className="main-content">
        <PaymentsClient payments={payments} userEmail={user.email} />
      </main>
    </div>
  )
}
