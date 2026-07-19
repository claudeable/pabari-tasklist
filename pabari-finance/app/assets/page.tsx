import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getAssets } from '@/lib/db'
import Nav from '@/components/Nav'
import AssetsClient from './AssetsClient'

export default async function AssetsPage() {
  const cookieStore = cookies()
  const token = cookieStore.get('fin-session')?.value
  if (!token) redirect('/login')
  const user = await verifyToken(token)
  if (!user) redirect('/login')

  const assets = await getAssets()

  return (
    <div className="layout">
      <Nav userName={user.name} userEmail={user.email} />
      <main className="main-content">
        <AssetsClient assets={assets} userEmail={user.email} />
      </main>
    </div>
  )
}
