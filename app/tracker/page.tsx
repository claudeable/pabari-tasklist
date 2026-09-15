import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getTrackerProjects } from '@/lib/tracker'
import TrackerBoard from '@/components/TrackerBoard'

export const dynamic = 'force-dynamic'

export default async function TrackerPage() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) redirect('/login')
  if (user.role !== 'admin') redirect('/')

  const projects = await getTrackerProjects()
  return <TrackerBoard initialProjects={projects} currentUser={user} />
}
