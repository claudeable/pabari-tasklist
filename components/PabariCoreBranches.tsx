'use client'
import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import InactivityGuard from './InactivityGuard'
import NotificationBell from './NotificationBell'

interface Props { currentUser: SessionUser }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const BRANCHES = [
  {
    key:     'kenya',
    label:   'Pabari Kenya',
    flag:    '🇰🇪',
    desc:    'Tasks · Projects · Documents · Connect · Centre',
    accent:  '#22c55e',
    href:    '/tasks/hub',
    active:  true,
    stat:    'Open workspace',
  },
  {
    key:     'india',
    label:   'Pabari India',
    flag:    '🇮🇳',
    desc:    'Tasks · Projects · Documents · Connect · Centre',
    accent:  '#f97316',
    href:    null,
    active:  false,
    stat:    'Coming soon',
  },
  {
    key:     'dubai',
    label:   'Pabari Dubai',
    flag:    '🇦🇪',
    desc:    'Tasks · Projects · Documents · Connect · Centre',
    accent:  '#38bdf8',
    href:    null,
    active:  false,
    stat:    'Coming soon',
  },
]

export default function PabariCoreBranches({ currentUser }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const firstName = currentUser.name?.split(' ')[0] ?? 'there'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter,Arial,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <InactivityGuard />

      {/* NAV */}
      <nav style={{ background: '#0f1a12', borderBottom: '1px solid #1e2e1a', padding: isMobile ? '0 16px' : '0 32px', display: 'flex', alignItems: 'center', height: 52, position: 'sticky', top: 0, zIndex: 50, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 15, color: '#b5833a', letterSpacing: '0.15em' }}>PABARI</span>
          </a>
          {!isMobile && (
            <>
              <span style={{ color: '#2d4a35', fontSize: 13 }}>/</span>
              <span style={{ fontSize: 12, color: '#a3c4ae', fontWeight: 600 }}>Core</span>
            </>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <NotificationBell userEmail={currentUser.email} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '4px 12px' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a3a2a', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#22c55e' }}>
            {(currentUser.name ?? 'U')[0].toUpperCase()}
          </div>
          {!isMobile && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{currentUser.name}</span>}
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 11, cursor: 'pointer', marginLeft: 4, padding: 0 }}>Sign out</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #0f1a12 0%, #1a2d1f 100%)', padding: isMobile ? '28px 16px 32px' : '40px 32px 44px', borderBottom: '1px solid #1e2e1a' }}>
        <div style={{ maxWidth: 860, margin: '0 auto' }}>
          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <a href="/" style={{ fontSize: 12, color: '#4a7055', textDecoration: 'none', fontWeight: 600 }}>Workspace</a>
            <span style={{ color: '#2d4a35', fontSize: 12 }}>›</span>
            <span style={{ fontSize: 12, color: '#a3c4ae', fontWeight: 600 }}>Pabari Core</span>
          </div>
          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#4a7055', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            {getGreeting()}, {firstName}
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 26 : 38, fontWeight: 900, color: '#e2ede7', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Pabari Core
          </h1>
          <p style={{ margin: '10px 0 0', color: '#4a7055', fontSize: isMobile ? 12 : 13, maxWidth: 480 }}>
            Select a branch to access its workspace — tasks, projects, documents and more.
          </p>
        </div>
      </div>

      {/* BRANCH GRID */}
      <div style={{ flex: 1, maxWidth: 860, margin: '0 auto', width: '100%', padding: isMobile ? '28px 16px 56px' : '44px 32px 72px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 22 }}>
          Select a Branch
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 14 : 20 }}>
          {BRANCHES.map(branch => {
            const card = (
              <div
                key={branch.key}
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: isMobile ? '22px 20px' : '28px 24px',
                  cursor: branch.active ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  position: 'relative',
                  overflow: 'hidden',
                  opacity: branch.active ? 1 : 0.55,
                }}
                onMouseEnter={e => {
                  if (!branch.active) return
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(-3px)'
                  el.style.boxShadow = '0 10px 28px rgba(0,0,0,0.10)'
                  el.style.borderColor = branch.accent
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLDivElement
                  el.style.transform = 'translateY(0)'
                  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.06)'
                  el.style.borderColor = '#e2e8f0'
                }}
              >
                {/* Accent bar */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: branch.accent, borderRadius: '14px 14px 0 0' }} />

                {/* Flag */}
                <div style={{ fontSize: isMobile ? 38 : 48, marginBottom: 14, lineHeight: 1 }}>{branch.flag}</div>

                {/* Label */}
                <div style={{ fontSize: isMobile ? 16 : 18, fontWeight: 800, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.01em' }}>{branch.label}</div>

                {/* Desc */}
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18, lineHeight: 1.5 }}>{branch.desc}</div>

                {/* Badge + arrow */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: branch.active ? branch.accent : '#94a3b8',
                    background: branch.active ? `${branch.accent}18` : '#f1f5f9',
                    border: `1px solid ${branch.active ? `${branch.accent}33` : '#e2e8f0'}`,
                    borderRadius: 20,
                    padding: '4px 12px',
                  }}>
                    {branch.stat}
                  </span>
                  {branch.active && <span style={{ fontSize: 18, color: '#cbd5e1' }}>→</span>}
                </div>
              </div>
            )

            return branch.href
              ? <a key={branch.key} href={branch.href} style={{ textDecoration: 'none', display: 'block' }}>{card}</a>
              : <div key={branch.key}>{card}</div>
          })}
        </div>

        {/* Back link */}
        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a href="/" style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', fontWeight: 500 }}>← Back to Workspace</a>
        </div>
      </div>
    </div>
  )
}
