import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'
import PettyCashForm from '@/components/PettyCashForm'

export const dynamic = 'force-dynamic'

export default async function NewPettyCashPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')

  // Look up HOD name from reports_to
  let hodName = ''
  if (user.reports_to) {
    const rows = await query<Record<string, unknown>>(
      'SELECT name FROM users WHERE LOWER(email) = LOWER($1)',
      [user.reports_to]
    )
    if (rows.length > 0) hodName = String(rows[0].name)
  }

  const hasKiscol = user.companies.includes('ALL') || user.companies.includes('KISCOL')

  return (
    <PettyCashForm
      currentUser={user}
      hodName={hodName || user.reports_to}
      hasKiscol={hasKiscol}
    />
  )
}
