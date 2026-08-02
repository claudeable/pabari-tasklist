// ============================================================
// PABARI ERP — Unified Hub
// Central launcher for all users. Shows role-appropriate module
// cards plus sub-portal cards (Smart Ops, PIL/KETRACO, Property).
//
// Sub-portal SSO flow:
//   1. User clicks portal card → handlePortalLaunch(portalKey)
//   2. POST /api/sso/token  → receives one-time token
//   3. Redirect to PORTAL_URL/auth/sso?token=xxx
//   4. Sub-portal validates token via POST /api/sso/validate
//
// Portal URLs:
//   Smart Ops  → joint-collaboration-portal.vercel.app
//   PIL/KETRACO → pil-transmission-lines-app.up.railway.app
//   Property   → not yet deployed
// ============================================================
'use client'
import { useState, useEffect } from 'react'
import { SessionUser, FINANCE_VISIBLE_EMAILS } from '@/types'
import InactivityGuard from './InactivityGuard'
import NotificationBell from './NotificationBell'

interface Props { currentUser: SessionUser }

interface HubStats {
  tasks: number; finance: number; projects: number
  docs: number; invoices: number; deliveries: number
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate() {
  return new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
}

export default function UnifiedHub({ currentUser }: Props) {
  const [stats,        setStats]        = useState<HubStats | null>(null)
  const [isMobile,     setIsMobile]     = useState(false)
  const [launchingKey, setLaunchingKey] = useState<string | null>(null)

  const firstName  = (currentUser.name?.split(' ')[0] ?? 'there')
  const role       = currentUser.role
  const isAdmin    = role === 'admin'
  const isDirector = role === 'director' || role === 'ceo'
  const isManager  = role === 'manager'
  const canFinance = isAdmin || isDirector || FINANCE_VISIBLE_EMAILS.has(currentUser.email ?? '')
  const portals    = (currentUser as unknown as { portals?: string[] }).portals ?? []

  // SSO redirect for external sub-portals
  async function handlePortalLaunch(portalKey: string) {
    setLaunchingKey(portalKey)
    try {
      const res = await fetch('/api/sso/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal: portalKey }),
      })
      const data = await res.json()
      if (res.ok && data.redirect_url) {
        window.location.href = data.redirect_url
      } else {
        alert(data.error ?? 'Access denied to this portal')
      }
    } catch {
      alert('Failed to launch portal — please try again')
    } finally {
      setLaunchingKey(null)
    }
  }

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/hub/stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d) })
      .catch(() => {})
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  // Module definitions
  const modules = [
    {
      key:     'tasks',
      label:   'Tasks',
      href:    '/tasks',
      icon:    '📋',
      color:   '#1a3a2a',
      accent:  '#22c55e',
      desc:    'Manage and track team tasks',
      stat:    stats ? `${stats.tasks} open` : '—',
      visible: true,
    },
    {
      key:     'projects',
      label:   'Projects',
      href:    '/projects',
      icon:    '📁',
      color:   '#1e3a5f',
      accent:  '#60a5fa',
      desc:    'Track projects and milestones',
      stat:    stats ? `${stats.projects} active` : '—',
      visible: !( role === 'staff' && !isAdmin),
    },
    {
      key:     'finance',
      label:   'Finance',
      href:    '/finance',
      icon:    '💰',
      color:   '#3b1a5f',
      accent:  '#a78bfa',
      desc:    'Invoices, quotations, delivery notes',
      stat:    stats ? `${stats.finance} pending` : '—',
      visible: canFinance,
    },
    {
      key:     'documents',
      label:   'Documents',
      href:    '/documents',
      icon:    '📄',
      color:   '#3b2a1a',
      accent:  '#f59e0b',
      desc:    'Company document library',
      stat:    stats ? `${stats.docs} files` : '—',
      visible: true,
    },
    {
      key:     'connect',
      label:   'Connect',
      href:    '/connect',
      icon:    '👥',
      color:   '#1a3a3a',
      accent:  '#22d3ee',
      desc:    'Staff directory and contacts',
      stat:    'Directory',
      visible: role !== 'staff' || isAdmin,
    },
    {
      key:     'centre',
      label:   'Centre',
      href:    '/centre',
      icon:    '💬',
      color:   '#2a1a3a',
      accent:  '#c084fc',
      desc:    'Chat, inbox and AI assistant',
      stat:    'Messages & AI',
      visible: true,
    },
    {
      key:     'intelligence',
      label:   'Intelligence',
      href:    '/intelligence',
      icon:    '⚡',
      color:   '#0a1a0f',
      accent:  '#4ade80',
      desc:    'Executive dashboard and briefings',
      stat:    'Live briefing',
      visible: isAdmin || isDirector,
    },
    {
      key:     'admin',
      label:   'Admin',
      href:    '/admin/users',
      icon:    '⚙️',
      color:   '#1a1a1a',
      accent:  '#9ca3af',
      desc:    'User management and system tools',
      stat:    'System admin',
      visible: isAdmin,
    },
  ].filter(m => m.visible)

  // ── External sub-portal cards ──────────────────────────────────────────────
  // These use SSO redirect instead of a plain href.
  // Visibility: admin always sees all; other roles need portals[] assignment.
  const subPortals = [
    {
      key:     'smartops',
      label:   'Smart Ops',
      icon:    '🏭',
      color:   '#1a2a3a',
      accent:  '#38bdf8',
      desc:    'Joint operations collaboration portal',
      stat:    'Smart Ops',
      visible: isAdmin || portals.includes('smartops'),
    },
    {
      key:     'pil',
      label:   'PIL / KETRACO',
      icon:    '⚡',
      color:   '#2a1a0a',
      accent:  '#fb923c',
      desc:    'Transmission lines project portal',
      stat:    'PIL KETRACO',
      visible: isAdmin || portals.includes('pil'),
    },
    {
      key:     'property',
      label:   'Property Mgmt',
      icon:    '🏢',
      color:   '#1a1a2a',
      accent:  '#818cf8',
      desc:    'Property management portal',
      stat:    'Coming soon',
      visible: isAdmin || portals.includes('property'),
    },
  ].filter(m => m.visible)
  // ────────────────────────────────────────────────────────────────────────────

  const cols = isMobile ? 2 : Math.min(modules.length, 4)

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter,Arial,sans-serif', display:'flex', flexDirection:'column' }}>
      <InactivityGuard />

      {/* NAV */}
      <nav style={{ background:'#0f1a12', borderBottom:'1px solid #1e2e1a', padding: isMobile ? '0 16px' : '0 32px', display:'flex', alignItems:'center', height:52, position:'sticky', top:0, zIndex:50, gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontWeight:900, fontSize:15, color:'#b5833a', letterSpacing:'0.15em' }}>PABARI</span>
          {!isMobile && <span style={{ fontSize:9, color:'#4a7055', fontWeight:700, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:4, padding:'2px 6px', letterSpacing:'0.06em' }}>ERP</span>}
        </div>
        <div style={{ flex:1 }} />
        <NotificationBell currentUser={currentUser} />
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'4px 12px' }}>
          <div style={{ width:24, height:24, borderRadius:'50%', background:'#1a3a2a', border:'1px solid #22c55e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#22c55e' }}>
            {(currentUser.name ?? 'U')[0].toUpperCase()}
          </div>
          {!isMobile && <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:500 }}>{currentUser.name}</span>}
          <button onClick={logout} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:11, cursor:'pointer', marginLeft:4, padding:0 }}>Sign out</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background:'linear-gradient(135deg, #0f1a12 0%, #1a2d1f 100%)', padding: isMobile ? '28px 16px 32px' : '40px 32px 44px', borderBottom:'1px solid #1e2e1a' }}>
        <div style={{ maxWidth:1100, margin:'0 auto' }}>
          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight:700, color:'#4a7055', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 }}>
            {getGreeting()}, {firstName}
          </div>
          <h1 style={{ margin:0, fontSize: isMobile ? 26 : 38, fontWeight:900, color:'#e2ede7', lineHeight:1.1, letterSpacing:'-0.02em' }}>
            Pabari Group Portal
          </h1>
          <p style={{ margin:'8px 0 0', color:'#4a7055', fontSize: isMobile ? 12 : 13 }}>{fmtDate()}</p>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex:1, maxWidth:1100, margin:'0 auto', width:'100%', padding: isMobile ? '24px 14px 48px' : '36px 32px 64px' }}>

        {/* Internal modules */}
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:18 }}>
          Your Modules
        </div>
        <ModuleGrid modules={modules} isMobile={isMobile} />

        {/* External sub-portals (SSO) */}
        {subPortals.length > 0 && (
          <>
            <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginTop:36, marginBottom:18, display:'flex', alignItems:'center', gap:8 }}>
              Connected Portals
              <span style={{ fontSize:9, fontWeight:700, color:'#22d3ee', background:'rgba(34,211,238,0.1)', border:'1px solid rgba(34,211,238,0.2)', borderRadius:4, padding:'2px 6px', letterSpacing:'0.06em' }}>SSO</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: isMobile ? 12 : 18 }}>
              {subPortals.map(p => (
                <button
                  key={p.key}
                  onClick={() => handlePortalLaunch(p.key)}
                  disabled={launchingKey === p.key}
                  style={{
                    textAlign:'left', background:'white', border:'1px solid #e2e8f0', borderRadius:12,
                    padding: isMobile ? '18px 16px' : '24px 22px', cursor:'pointer', transition:'all 0.15s',
                    boxShadow:'0 1px 3px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden',
                    opacity: launchingKey === p.key ? 0.7 : 1,
                  }}
                  onMouseEnter={e => { const el = e.currentTarget; el.style.transform='translateY(-2px)'; el.style.boxShadow=`0 8px 24px rgba(0,0,0,0.10)`; el.style.borderColor=p.accent }}
                  onMouseLeave={e => { const el = e.currentTarget; el.style.transform='translateY(0)'; el.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'; el.style.borderColor='#e2e8f0' }}
                >
                  <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:p.accent, borderRadius:'12px 12px 0 0' }} />
                  <div style={{ fontSize: isMobile ? 28 : 34, marginBottom:12, lineHeight:1 }}>{p.icon}</div>
                  <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:800, color:'#0f172a', marginBottom:4, letterSpacing:'-0.01em' }}>{p.label}</div>
                  <div style={{ fontSize: isMobile ? 11 : 12, color:'#64748b', marginBottom:14, lineHeight:1.4 }}>{p.desc}</div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <span style={{ fontSize:11, fontWeight:700, color:p.accent, background:`${p.accent}18`, border:`1px solid ${p.accent}33`, borderRadius:20, padding:'3px 10px' }}>
                      {launchingKey === p.key ? 'Launching…' : p.stat}
                    </span>
                    <span style={{ fontSize:16, color:'#cbd5e1' }}>↗</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Signed-in badge */}
        <div style={{ marginTop:32, display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Signed in as</span>
          <span style={{ fontSize:10, fontWeight:700, color:'#475569', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:20, padding:'2px 10px', textTransform:'capitalize' }}>
            {currentUser.name} · {role}
          </span>
        </div>
      </div>
    </div>
  )
}

// Extracted so internal-module cards don't share click handler type issues
function ModuleGrid({ modules, isMobile }: {
  modules: { key:string; label:string; href:string; icon:string; color:string; accent:string; desc:string; stat:string }[]
  isMobile: boolean
}) {
  const cols = isMobile ? 2 : Math.min(modules.length, 4)
  return (
    <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, 1fr)`, gap: isMobile ? 12 : 18 }}>
      {modules.map(mod => (
        <a key={mod.key} href={mod.href} style={{ textDecoration:'none', display:'block' }}>
          <div
            style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding: isMobile ? '18px 16px' : '24px 22px', cursor:'pointer', transition:'all 0.15s', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', height:'100%', position:'relative', overflow:'hidden' }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.transform='translateY(-2px)'; el.style.boxShadow=`0 8px 24px rgba(0,0,0,0.10)`; el.style.borderColor=mod.accent }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.transform='translateY(0)'; el.style.boxShadow='0 1px 3px rgba(0,0,0,0.06)'; el.style.borderColor='#e2e8f0' }}
          >
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:mod.accent, borderRadius:'12px 12px 0 0' }} />
            <div style={{ fontSize: isMobile ? 28 : 34, marginBottom:12, lineHeight:1 }}>{mod.icon}</div>
            <div style={{ fontSize: isMobile ? 15 : 17, fontWeight:800, color:'#0f172a', marginBottom:4, letterSpacing:'-0.01em' }}>{mod.label}</div>
            <div style={{ fontSize: isMobile ? 11 : 12, color:'#64748b', marginBottom:14, lineHeight:1.4 }}>{mod.desc}</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:'auto' }}>
              <span style={{ fontSize:11, fontWeight:700, color:mod.accent, background:`${mod.accent}18`, border:`1px solid ${mod.accent}33`, borderRadius:20, padding:'3px 10px' }}>{mod.stat}</span>
              <span style={{ fontSize:16, color:'#cbd5e1' }}>→</span>
            </div>
          </div>
        </a>
      ))}
    </div>
  )
}
