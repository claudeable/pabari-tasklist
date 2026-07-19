import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getVehicles } from '@/lib/db'
import Nav from '@/components/Nav'
import VehiclesClient from './VehiclesClient'

export default async function VehiclesPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('fin-session')?.value
  if (!token) redirect('/login')
  const user = await verifyToken(token)
  if (!user) redirect('/login')

  const vehicles = await getVehicles()

  return (
    <div className="layout">
      <Nav userName={user.name} userEmail={user.email} />
      <main className="main-content">
        <VehiclesClient vehicles={vehicles} userEmail={user.email} />
      </main>
    </div>
  )
}
