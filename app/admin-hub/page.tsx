'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User { name: string; email: string; role: string }

const SECTIONS = [
  {
    key: 'users',
    icon: '👥',
    label: 'User Management',
    desc: 'Create, edit, and manage all Pabari users. Assign roles, departments, and portal access.',
    href: '/admin-hub/users',
    accent: '#6366f1',
    badge: 'Manage users',
  },
  {
    key: 'security',
    icon: '🔒',
    label: 'Security Centre',
    desc: 'Audit logs, session management, access control, and system security settings.',
    href: '/admin-hub/security',
    accent: '#ef4444',
    badge: 'View security',
  },
]

export default function AdminHubPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/auth/me', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || data.role !== 'admin') {
          router.replace('/')
          return
        }
        setUser(data)
        setLoading(false)
      })
      .catch(() => router.replace('/'))
  }, [router])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'Inter,Arial,sans-serif' }}>
        <span style={{ color: '#94a3b8', fontSize: 14 }}>Loading…</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter,Arial,sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* NAV */}
      <nav style={{ background: '#0f1a12', borderBottom: '1px solid #1e2e1a', padding: isMobile ? '0 16px' : '0 32px', display: 'flex', alignItems: 'center', height: 52, position: 'sticky', top: 0, zIndex: 50, gap: 16 }}>
        <button
          onClick={() => router.push('/')}
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}
        >
          ← <span style={{ fontWeight: 700, color: '#b5833a', letterSpacing: '0.15em', fontSize: 15 }}>PABARI</span>
        </button>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>{user?.name}</span>
      </nav>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #0f1a12 0%, #1a2d1f 100%)', padding: isMobile ? '28px 16px 32px' : '40px 32px 44px', borderBottom: '1px solid #1e2e1a' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            System Administration
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 26 : 36, fontWeight: 900, color: '#e2ede7', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            🛡️ Admin Hub
          </h1>
          <p style={{ margin: '8px 0 0', color: '#4a7055', fontSize: isMobile ? 12 : 13 }}>
            Manage users, security, and system access across all Pabari portals
          </p>
        </div>
      </div>

      {/* CARDS */}
      <div style={{ flex: 1, maxWidth: 860, margin: '0 auto', width: '100%', padding: isMobile ? '28px 16px 56px' : '44px 32px 72px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 22 }}>
          Admin Tools
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: isMobile ? 14 : 22 }}>
          {SECTIONS.map(s => (
            <a key={s.key} href={s.href} style={{ textDecoration: 'none', display: 'block' }}>
              <div
                style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 14, padding: isMobile ? '22px 20px' : '32px 28px', cursor: 'pointer', transition: 'all 0.15s', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.transform = 'translateY(-3px)'; el.style.boxShadow = `0 10px 28px rgba(0,0,0,0.10)`; el.style.borderColor = s.accent }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.transform = 'translateY(0)'; el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'; el.style.borderColor = '#e2e8f0' }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: s.accent, borderRadius: '14px 14px 0 0' }} />
                <div style={{ fontSize: isMobile ? 36 : 44, marginBottom: 16, lineHeight: 1 }}>{s.icon}</div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#0f172a', marginBottom: 6, letterSpacing: '-0.01em' }}>{s.label}</div>
                <div style={{ fontSize: isMobile ? 12 : 13, color: '#64748b', marginBottom: 18, lineHeight: 1.5 }}>{s.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: s.accent, background: `${s.accent}18`, border: `1px solid ${s.accent}33`, borderRadius: 20, padding: '4px 12px' }}>{s.badge}</span>
                  <span style={{ fontSize: 18, color: '#cbd5e1' }}>→</span>
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Quick note */}
        <div style={{ marginTop: 32, background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 18 }}>💡</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Portal access tip</div>
            <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.6 }}>
              To give a user access to Smart Ops, PIL, or other portals — go to <strong>User Management</strong>, find the user, and tick the portal checkboxes. They will be auto-provisioned on their first login.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
