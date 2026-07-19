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
    <div className="layout">
      <Nav userName={user.name} userEmail={user.email} />
      <main className="main-content">
        <BudgetsClient budgets={budgets} userEmail={user.email} />
      </main>
    </div>
  )
}
