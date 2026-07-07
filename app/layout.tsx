import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import ChatWidget from '@/components/ChatWidget'
import './globals.css'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pabari Group ERP',
  description: 'Task & Pending List Management System',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const session     = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null

  return (
    <html lang="en">
      <body>
        {children}
        {currentUser && <ChatWidget currentUser={currentUser} />}
      </body>
    </html>
  )
}
