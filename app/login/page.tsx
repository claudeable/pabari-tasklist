import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { redirect } from 'next/navigation'
import LoginForm from './LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string }
}) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  if (session?.value) {
    const user = await verifyToken(session.value)
    if (user) {
      const dest = searchParams.redirect
      redirect(dest && dest.startsWith('/') ? dest : '/')
    }
  }
  return <LoginForm redirectTo={searchParams.redirect} />
}
