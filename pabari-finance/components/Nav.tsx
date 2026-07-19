'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const LINKS = [
  { href: '/dashboard', label: 'Dashboard',       icon: '📊' },
  { href: '/tasks',     label: 'Finance Tasks',   icon: '✅' },
  { href: '/invoices',  label: 'Invoices & LPOs', icon: '📄' },
  { href: '/payments',  label: 'Payments',        icon: '💸' },
  { href: '/budgets',   label: 'Budgets',         icon: '📈' },
  { href: '/assets',    label: 'Assets',          icon: '🏗️' },
  { href: '/vehicles',  label: 'Fleet & Vehicles',icon: '🚗' },
]

const MAIN_APP_URL = 'https://pabari-tasklist-production.up.railway.app'

export default function Nav({ userName, userEmail }: { userName: string; userEmail: string }) {
  const path = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <nav className="nav">
      {/* Logo */}
      <div className="nav-logo">
        <span className="nav-logo-icon">💰</span>
        <div className="nav-logo-title">Finance Portal</div>
        <div className="nav-logo-sub">Pabari Group</div>
      </div>

      {/* Links */}
      <div className="nav-links">
        <div className="nav-section-label">Finance</div>
        {LINKS.map(l => {
          const active = path === l.href || (l.href !== '/dashboard' && path.startsWith(l.href))
          return (
            <Link key={l.href} href={l.href} className={`nav-link${active ? ' active' : ''}`}>
              <span className="nav-link-icon">{l.icon}</span>
              {l.label}
            </Link>
          )
        })}

        <div className="nav-section-label" style={{ marginTop: 20 }}>Switch Portal</div>
        <a href={MAIN_APP_URL} target="_blank" rel="noopener noreferrer" className="nav-ext-link">
          <span className="nav-link-icon">🗂️</span>
          Task Board ↗
        </a>
      </div>

      {/* Footer */}
      <div className="nav-footer">
        <div className="nav-user">
          <div className="nav-user-name">{userName}</div>
          <div className="nav-user-email">{userEmail}</div>
        </div>
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            width: '100%', padding: '8px 10px', borderRadius: 6,
            background: 'transparent', color: '#fca5a5',
            fontSize: 13, cursor: 'pointer', border: 'none',
          }}
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </nav>
  )
}
