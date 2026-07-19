import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getBudgets } from '@/lib/db'
import Nav from '@/components/Nav'
import BudgetsClient from './BudgetsClient'

export default async function BudgetsPage() {
  const token = (await cookies()).get('fin-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) redirect('/login')

  const budgets = await getBudgets()
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Nav userName={user.name} />
      <main style={{ flex: 1, padding: '32px 36px' }}>
        <BudgetsClient budgets={budgets} />
      </main>
    </div>
  )
}
