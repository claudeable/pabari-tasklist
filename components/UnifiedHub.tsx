// ============================================================
// PABARI WORKSPACE — Unified Hub
// 4-card launcher:
//   1. Task Management       → /tasks  (internal Pabari system)
//   2. Smart Ops             → SSO → joint-collaboration-portal.vercel.app
//   3. PIL Transmission Lines → SSO → pil-frontend-production.up.railway.app
//   4. Property Mgmt         → SSO → (not yet deployed)
//
// SSO flow for external portals:
//   POST /api/sso/token → one-time token → redirect to PORTAL/sso?token=xxx
//   Sub-portal calls POST /api/sso/validate (server-to-server) to verify
// ============================================================
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

function fmtDate() {
  return new Date().toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
}

export default function UnifiedHub({ currentUser }: Props) {
  const [isMobile,    setIsMobile]    = useState(false)
  const [openTasks,   setOpenTasks]   = useState<number | null>(null)
  const [ssoLoading,  setSsoLoading]  = useState<string | null>(null)
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwCurrent,   setPwCurrent]   = useState('')
  const [pwNew,       setPwNew]       = useState('')
  const [pwConfirm,   setPwConfirm]   = useState('')
  const [pwLoading,   setPwLoading]   = useState(false)
  const [pwError,     setPwError]     = useState('')
  const [pwSuccess,   setPwSuccess]   = useState(false)

  const firstName    = (currentUser.name?.split(' ')[0] ?? 'there')
  const role         = currentUser.role
  const isAdmin      = role === 'admin'
  const portals      = currentUser.portals ?? []
  // Show Task Management only if: admin, regular staff (no portals assigned), or explicitly granted tasks portal
  const showTasks    = isAdmin || portals.length === 0 || portals.includes('tasks')

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Fetch just the open-task count for the Task Management card badge
  useEffect(() => {
    fetch('/api/hub/stats', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOpenTasks(d.tasks) })
      .catch(() => {})
  }, [])

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    window.location.href = '/login'
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pwNew !== pwConfirm) { setPwError('New passwords do not match.'); return }
    setPwLoading(true); setPwError('')
    const res = await fetch('/api/auth/change-password', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
    })
    const data = await res.json()
    setPwLoading(false)
    if (!res.ok) { setPwError(data.error ?? 'Failed to change password.'); return }
    setPwSuccess(true)
    setTimeout(() => { setShowPwModal(false); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwSuccess(false) }, 2000)
  }

  async function launchPortal(portalKey: string) {
    setSsoLoading(portalKey)
    try {
      const res  = await fetch('/api/sso/token', { method:'POST', credentials:'include', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ portal: portalKey }) })
      const data = await res.json()
      if (data.redirect_url) { window.location.href = data.redirect_url; return }
      alert(data.error || 'Unable to launch portal')
    } catch {
      alert('Could not reach server. Please try again.')
    } finally {
      setSsoLoading(null)
    }
  }


  // ── Internal cards ─────────────────────────────────────────────────────────
  const internalCard = {
    key:    'tasks',
    label:  'Task Management',
    href:   '/tasks/hub',
    icon:   '📋',
    accent: '#22c55e',
    desc:   'Tasks · Projects · Finance · Documents · Connect · Centre',
    stat:   openTasks !== null ? `${openTasks} open tasks` : 'Loading…',
  }

  const externalCards = [
    {
      key:     'smartops',
      label:   'Smart Ops',
      icon:    '🏭',
      accent:  '#38bdf8',
      desc:    'Joint operations collaboration portal',
      url:     'https://smart-ops-frontend-production.up.railway.app',
      visible: isAdmin || portals.includes('smartops'),
    },
    {
      key:     'pil',
      label:   'PIL Transmission Lines',
      icon:    '⚡',
      accent:  '#fb923c',
      desc:    'Transmission lines project portal',
      url:     'https://pil-frontend-production.up.railway.app',
      visible: isAdmin || portals.includes('pil'),
    },
    {
      key:     'property',
      label:   'Property Mgmt',
      icon:    '🏢',
      accent:  '#818cf8',
      desc:    'Property management portal',
      url:     'https://pabari-property-production.up.railway.app',
      visible: isAdmin || portals.includes('property'),
    },
    {
      key:     'shelf',
      label:   'Pabari Shelf',
      icon:    '📁',
      accent:  '#6366f1',
      desc:    'Central document library',
      url:     'https://pabari-shelf-production.up.railway.app',
      visible: isAdmin || portals.includes('shelf'),
    },
  ].filter(p => p.visible)
  // ────────────────────────────────────────────────────────────────────────────

  const totalCards  = (showTasks ? 1 : 0) + externalCards.length + (isAdmin ? 1 : 0)
  const gridCols    = isMobile ? 1 : Math.min(totalCards, 2)

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter,Arial,sans-serif', display:'flex', flexDirection:'column' }}>
      <InactivityGuard />

      {/* NAV */}
      <nav style={{ background:'#0f1a12', borderBottom:'1px solid #1e2e1a', padding: isMobile ? '0 16px' : '0 32px', display:'flex', alignItems:'center', height:52, position:'sticky', top:0, zIndex:50, gap:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontWeight:900, fontSize:15, color:'#b5833a', letterSpacing:'0.15em' }}>PABARI</span>
          {!isMobile && <span style={{ fontSize:9, color:'#4a7055', fontWeight:700, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:4, padding:'2px 6px', letterSpacing:'0.06em' }}>WORKSPACE</span>}
        </div>
        <div style={{ flex:1 }} />
        <NotificationBell userEmail={currentUser.email} />
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
        <div style={{ maxWidth:900, margin:'0 auto' }}>
          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight:700, color:'#4a7055', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 }}>
            {getGreeting()}, {firstName}
          </div>
          <h1 style={{ margin:0, fontSize: isMobile ? 26 : 38, fontWeight:900, color:'#e2ede7', lineHeight:1.1, letterSpacing:'-0.02em' }}>
            Pabari Workspace
          </h1>
          <p style={{ margin:'8px 0 0', color:'#4a7055', fontSize: isMobile ? 12 : 13 }}>{fmtDate()}</p>
        </div>
      </div>

      {/* PORTAL GRID */}
      <div style={{ flex:1, maxWidth:900, margin:'0 auto', width:'100%', padding: isMobile ? '28px 16px 56px' : '44px 32px 72px' }}>
        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:22 }}>
          Select a Portal
        </div>

        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${gridCols}, 1fr)`, gap: isMobile ? 14 : 22 }}>

          {/* Task Management — internal, plain link */}
          {showTasks && <a href={internalCard.href} style={{ textDecoration:'none', display:'block' }}>
            <div
              style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:14, padding: isMobile ? '22px 20px' : '32px 28px', cursor:'pointer', transition:'all 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden' }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.transform='translateY(-3px)'; el.style.boxShadow=`0 10px 28px rgba(0,0,0,0.10)`; el.style.borderColor=internalCard.accent }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.transform='translateY(0)'; el.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; el.style.borderColor='#e2e8f0' }}
            >
              <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:internalCard.accent, borderRadius:'14px 14px 0 0' }} />
              <div style={{ fontSize: isMobile ? 36 : 44, marginBottom:16, lineHeight:1 }}>{internalCard.icon}</div>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:'#0f172a', marginBottom:6, letterSpacing:'-0.01em' }}>{internalCard.label}</div>
              <div style={{ fontSize: isMobile ? 12 : 13, color:'#64748b', marginBottom:18, lineHeight:1.5 }}>{internalCard.desc}</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, fontWeight:700, color:internalCard.accent, background:`${internalCard.accent}18`, border:`1px solid ${internalCard.accent}33`, borderRadius:20, padding:'4px 12px' }}>
                  {internalCard.stat}
                </span>
                <span style={{ fontSize:18, color:'#cbd5e1' }}>→</span>
              </div>
            </div>
          </a>}

          {/* Admin Hub — admin only */}
          {isAdmin && <a href="/admin-hub" style={{ textDecoration:'none', display:'block' }}>
            <div
              style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:14, padding: isMobile ? '22px 20px' : '32px 28px', cursor:'pointer', transition:'all 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden' }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.transform='translateY(-3px)'; el.style.boxShadow='0 10px 28px rgba(0,0,0,0.10)'; el.style.borderColor='#6366f1' }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.transform='translateY(0)'; el.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; el.style.borderColor='#e2e8f0' }}
            >
              <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:'#6366f1', borderRadius:'14px 14px 0 0' }} />
              <div style={{ fontSize: isMobile ? 36 : 44, marginBottom:16, lineHeight:1 }}>🛡️</div>
              <div style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:'#0f172a', marginBottom:6, letterSpacing:'-0.01em' }}>Admin Hub</div>
              <div style={{ fontSize: isMobile ? 12 : 13, color:'#64748b', marginBottom:18, lineHeight:1.5 }}>Users · Security · Portal Access</div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:12, fontWeight:700, color:'#6366f1', background:'#6366f118', border:'1px solid #6366f133', borderRadius:20, padding:'4px 12px' }}>Manage system</span>
                <span style={{ fontSize:18, color:'#cbd5e1' }}>→</span>
              </div>
            </div>
          </a>}

          {/* External portals — SSO launch */}
          {externalCards.map(p => {
            const launching = ssoLoading === p.key
            return (
            <div
              key={p.key}
              onClick={() => { if (!p.url) { alert('This portal is not yet deployed.'); return } launchPortal(p.key) }}
              style={{ textDecoration:'none', display:'block', opacity: p.url ? 1 : 0.6, cursor: p.url && !launching ? 'pointer' : launching ? 'wait' : 'not-allowed' }}
            >
              <div
                style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:14, padding: isMobile ? '22px 20px' : '32px 28px', transition:'all 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden', opacity: launching ? 0.7 : 1 }}
                onMouseEnter={e => { if (p.url && !launching) { const el = e.currentTarget; el.style.transform='translateY(-3px)'; el.style.boxShadow=`0 10px 28px rgba(0,0,0,0.10)`; el.style.borderColor=p.accent } }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.transform='translateY(0)'; el.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; el.style.borderColor='#e2e8f0' }}
              >
                <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:p.accent, borderRadius:'14px 14px 0 0' }} />
                <div style={{ fontSize: isMobile ? 36 : 44, marginBottom:16, lineHeight:1 }}>{launching ? '⏳' : p.icon}</div>
                <div style={{ fontSize: isMobile ? 18 : 22, fontWeight:800, color:'#0f172a', marginBottom:6, letterSpacing:'-0.01em' }}>{p.label}</div>
                <div style={{ fontSize: isMobile ? 12 : 13, color:'#64748b', marginBottom:18, lineHeight:1.5 }}>{p.desc}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, fontWeight:700, color:p.accent, background:`${p.accent}18`, border:`1px solid ${p.accent}33`, borderRadius:20, padding:'4px 12px' }}>
                    {!p.url ? 'Coming soon' : launching ? 'Launching…' : 'Open portal'}
                  </span>
                  <span style={{ fontSize:18, color:'#cbd5e1' }}>↗</span>
                </div>
              </div>
            </div>
            )
          })}

        </div>

        {/* Signed-in badge + Change Password */}
        <div style={{ marginTop:36, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Signed in as</span>
          <span style={{ fontSize:10, fontWeight:700, color:'#475569', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:20, padding:'2px 10px', textTransform:'capitalize' }}>
            {currentUser.name} · {role}
          </span>
          <button
            onClick={() => setShowPwModal(true)}
            style={{ fontSize:10, fontWeight:700, color:'#22c55e', background:'transparent', border:'1px solid #22c55e44', borderRadius:20, padding:'2px 10px', cursor:'pointer', letterSpacing:'0.04em' }}
          >
            Change password
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPwModal && (
        <div
          onClick={() => setShowPwModal(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'white', borderRadius:16, padding:'32px 28px', width:'100%', maxWidth:380, boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
          >
            <div style={{ fontSize:18, fontWeight:800, color:'#0f172a', marginBottom:4 }}>Change Password</div>
            <div style={{ fontSize:12, color:'#64748b', marginBottom:22 }}>Must be 8+ chars with uppercase, number, and special character.</div>

            {pwSuccess ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>✅</div>
                <div style={{ fontWeight:700, color:'#22c55e' }}>Password updated successfully!</div>
              </div>
            ) : (
              <form onSubmit={changePassword}>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Current Password</label>
                  <input
                    type="password" required value={pwCurrent}
                    onChange={e => setPwCurrent(e.target.value)}
                    style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}
                    placeholder="Your current password"
                  />
                </div>
                <div style={{ marginBottom:14 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>New Password</label>
                  <input
                    type="password" required value={pwNew}
                    onChange={e => setPwNew(e.target.value)}
                    style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}
                    placeholder="New password"
                  />
                </div>
                <div style={{ marginBottom:20 }}>
                  <label style={{ fontSize:11, fontWeight:700, color:'#475569', display:'block', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.06em' }}>Confirm New Password</label>
                  <input
                    type="password" required value={pwConfirm}
                    onChange={e => setPwConfirm(e.target.value)}
                    style={{ width:'100%', border:'1px solid #e2e8f0', borderRadius:8, padding:'9px 12px', fontSize:13, outline:'none', boxSizing:'border-box' }}
                    placeholder="Confirm new password"
                  />
                </div>
                {pwError && <div style={{ fontSize:12, color:'#ef4444', marginBottom:14, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'8px 12px' }}>{pwError}</div>}
                <div style={{ display:'flex', gap:10 }}>
                  <button
                    type="button" onClick={() => setShowPwModal(false)}
                    style={{ flex:1, padding:'10px', border:'1px solid #e2e8f0', borderRadius:8, background:'white', fontSize:13, fontWeight:600, color:'#64748b', cursor:'pointer' }}
                  >Cancel</button>
                  <button
                    type="submit" disabled={pwLoading}
                    style={{ flex:1, padding:'10px', border:'none', borderRadius:8, background:'#22c55e', fontSize:13, fontWeight:700, color:'white', cursor: pwLoading ? 'wait' : 'pointer', opacity: pwLoading ? 0.7 : 1 }}
                  >{pwLoading ? 'Saving…' : 'Update Password'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
