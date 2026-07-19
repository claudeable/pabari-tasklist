import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getAssets, getVehicles } from '@/lib/assets'
import AssetDirectory from '@/components/AssetDirectory'

export const dynamic = 'force-dynamic'

export default async function AssetDirectoryPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')?.value
  const user = session ? await verifyToken(session) : null
  if (!user) redirect('/login')

  const [assets, vehicles] = await Promise.all([getAssets(), getVehicles()])

  const canEdit = user.role === 'admin' || user.name.toLowerCase().split(' ')[0] === 'harshil'

  return <AssetDirectory assets={assets} vehicles={vehicles} userEmail={user.email} canEdit={canEdit} />
}
