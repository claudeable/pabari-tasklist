import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pabari Finance',
  description: 'Finance portal for Pabari Group',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
