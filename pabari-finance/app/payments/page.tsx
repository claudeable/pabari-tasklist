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
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Nav userName={user.name} />
      <main style={{ flex: 1, padding: '32px 36px' }}>
        <PaymentsClient payments={payments} />
      </main>
    </div>
  )
}
