'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/tasks',     label: 'Finance Tasks', icon: '✅' },
  { href: '/invoices',  label: 'Invoices', icon: '📄' },
  { href: '/payments',  label: 'Payments', icon: '💸' },
  { href: '/budgets',   label: 'Budgets', icon: '📈' },
]

export default function Nav({ userName }: { userName: string }) {
  const path = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav style={{
      width: 220, minHeight: '100vh', background: '#14532d',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
    }}>
      <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #166534' }}>
        <div style={{ fontSize: 20, marginBottom: 4 }}>💰</div>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Pabari Finance</div>
        <div style={{ color: '#86efac', fontSize: 12, marginTop: 2 }}>{userName}</div>
      </div>

      <div style={{ flex: 1, padding: '12px 8px' }}>
        {LINKS.map(l => {
          const active = path === l.href || (l.href !== '/dashboard' && path.startsWith(l.href))
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 6, marginBottom: 2,
                color: active ? '#fff' : '#86efac',
                background: active ? 'rgba(255,255,255,.12)' : 'transparent',
                fontWeight: active ? 600 : 400,
                transition: 'background .15s',
              }}
            >
              <span>{l.icon}</span>
              <span style={{ fontSize: 13 }}>{l.label}</span>
            </Link>
          )
        })}
      </div>

      <div style={{ padding: '12px 8px', borderTop: '1px solid #166534' }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: 6,
            background: 'transparent', color: '#86efac', display: 'flex',
            alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer',
          }}
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </nav>
  )
}
