import type { Metadata, Viewport } from 'next'
import './globals.css'
import PWASetup from '@/components/PWASetup'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Pabari Group ERP',
  description: 'Task & Pending List Management System',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pabari',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1a3a2a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/pabari-icon-192.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Pabari" />
      </head>
      <body>
        {children}
        <PWASetup />
      </body>
    </html>
  )
}
