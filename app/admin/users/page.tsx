import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getUsers } from '@/lib/users'
import AdminUsers from '@/components/AdminUsers'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  if (!currentUser) redirect('/login')
  if (currentUser.role !== 'admin') redirect('/tasks')

  const users = await getUsers()
  const publicUsers = users.map(u => ({
    id: u.id, name: u.name, email: u.email,
    role: u.role, department: u.department, reports_to: u.reports_to,
    created_at: u.created_at,
  }))

  return <AdminUsers currentUser={currentUser} initialUsers={publicUsers} />
}
