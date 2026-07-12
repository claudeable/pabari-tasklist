import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getProjects } from '@/lib/projects'
import ProjectsBoard from '@/components/ProjectsBoard'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) redirect('/login')

  const projects = await getProjects()

  return <ProjectsBoard initialProjects={projects} currentUser={currentUser} />
}
