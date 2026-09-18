'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { SessionUser } from '@/types'
import InactivityGuard from '@/components/InactivityGuard'
import NotificationBell from '@/components/NotificationBell'

interface Props {
  currentUser: SessionUser
  children: React.ReactNode
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
const Icon = ({ d, size = 18 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  dashboard:    'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10',
  tasks:        'M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
  projects:     'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  reports:      'M18 20V10 M12 20V4 M6 20v-6',
  intelligence: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01',
  connect:      'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  centre:       'M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z M3 9l2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9 M12 3v6',
  documents:    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  chevronLeft:  'M15 18l-6-6 6-6',
  chevronRight: 'M9 18l6-6-6-6',
  menu:         'M3 12h18 M3 6h18 M3 18h18',
  back:         'M19 12H5 M12 5l-7 7 7 7',
}

const NAV = [
  { key: 'dashboard',    label: 'Dashboard',          href: '/core/dashboard',     icon: 'dashboard' },
  { key: 'tasks',        label: 'Tasks',               href: '/core/tasks',         icon: 'tasks' },
  { key: 'projects',     label: 'Project Tracker',     href: '/core/projects',      icon: 'projects' },
  { key: 'intelligence', label: 'Pabari Intelligence', href: '/core/intelligence',  icon: 'intelligence' },
  { key: 'connect',      label: 'Pabari Connect',      href: '/core/connect',       icon: 'connect' },
  { key: 'centre',       label: 'Pabari Centre',       href: '/core/centre',        icon: 'centre' },
  { key: 'shelf',        label: 'Pabari Shelf',        href: '/core/shelf',         icon: 'documents' },
]

export default function CoreShell({ currentUser, children }: Props) {
  const pathname           = usePathname()
  const [collapsed, setCollapsed]       = useState(false)
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [isMobile, setIsMobile]         = useState(false)

  const firstName = currentUser.name?.split(' ')[0] ?? 'Admin'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile nav on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  const sidebarW = collapsed && !isMobile ? 64 : 240

  const SidebarContent = ({ onNav }: { onNav?: () => void }) => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ height: 60, display: 'flex', alignItems: 'center', gap: 10, padding: collapsed && !isMobile ? '0 18px' : '0 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#b5833a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 900, color: 'white', letterSpacing: '-0.02em' }}>P</div>
        {(!collapsed || isMobile) && (
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2ede7', letterSpacing: '0.02em' }}>PABARI CORE</div>
            <div style={{ fontSize: 10, color: '#4a7055', fontWeight: 600, letterSpacing: '0.06em' }}>ADMIN</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={onNav}
              title={collapsed && !isMobile ? item.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed && !isMobile ? '10px 14px' : '9px 12px',
                borderRadius: 8, marginBottom: 2, textDecoration: 'none',
                background: active ? 'rgba(34,197,94,0.12)' : 'transparent',
                color: active ? '#22c55e' : 'rgba(255,255,255,0.55)',
                fontWeight: active ? 600 : 400,
                fontSize: 13.5,
                transition: 'all 0.12s',
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLAnchorElement).style.color = '#e2ede7' }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.55)' } }}
            >
              <span style={{ flexShrink: 0, color: 'inherit' }}>
                <Icon d={ICONS[item.icon as keyof typeof ICONS]} size={17} />
              </span>
              {(!collapsed || isMobile) && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
            </a>
          )
        })}
      </nav>

      {/* Back to workspace */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '10px 8px', flexShrink: 0 }}>
        <a
          href="/kenya"
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: collapsed && !isMobile ? '9px 14px' : '9px 12px', borderRadius: 8, textDecoration: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 12.5, justifyContent: collapsed && !isMobile ? 'center' : 'flex-start' }}
          onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.color = '#e2ede7'}
          onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.35)'}
        >
          <Icon d={ICONS.back} size={15} />
          {(!collapsed || isMobile) && <span>Back to Workspace</span>}
        </a>
      </div>

      {/* Collapse toggle — desktop only */}
      {!isMobile && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '8px' }}>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-end', gap: 6, padding: '7px 10px', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', fontSize: 12, borderRadius: 6 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.color = '#e2ede7'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.35)'}
          >
            <Icon d={collapsed ? ICONS.chevronRight : ICONS.chevronLeft} size={14} />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9', fontFamily: 'Inter,Arial,sans-serif' }}>
      <InactivityGuard />

      {/* Desktop Sidebar */}
      {!isMobile && (
        <aside style={{ width: sidebarW, flexShrink: 0, background: '#0f1a12', borderRight: '1px solid #1e2e1a', display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', transition: 'width 0.2s', overflow: 'hidden' }}>
          <SidebarContent />
        </aside>
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <aside style={{ position: 'fixed', left: 0, top: 0, bottom: 0, width: 240, background: '#0f1a12', zIndex: 50, display: 'flex', flexDirection: 'column', borderRight: '1px solid #1e2e1a' }}>
            <SidebarContent onNav={() => setMobileOpen(false)} />
          </aside>
        </>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{ height: 60, background: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 30, flexShrink: 0 }}>
          {/* Mobile menu button */}
          {isMobile && (
            <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
              <Icon d={ICONS.menu} size={20} />
            </button>
          )}

          {/* Breadcrumb */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Pabari Core</span>
            {(() => {
              const seg = pathname.split('/').filter(Boolean)
              if (seg.length > 1) {
                const label = NAV.find(n => n.href === '/' + seg.slice(0, 2).join('/'))?.label ?? seg[1]
                return (
                  <>
                    <span style={{ color: '#cbd5e1', fontSize: 12 }}>›</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>{label}</span>
                  </>
                )
              }
              return null
            })()}
          </div>

          <NotificationBell userEmail={currentUser.email} />

          {/* User pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: '5px 14px' }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a3a2a', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#22c55e', flexShrink: 0 }}>
              {(currentUser.name ?? 'A')[0].toUpperCase()}
            </div>
            {!isMobile && <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{firstName}</span>}
            <button onClick={logout} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer', padding: 0, marginLeft: 2 }}>Sign out</button>
          </div>
        </header>

        {/* Page content — no padding here; each page adds its own */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
