'use client'
import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import InactivityGuard from './InactivityGuard'
import NotificationBell from './NotificationBell'

interface Props {
  currentUser: SessionUser
  mustChangePassword?: boolean
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const BRANCHES = [
  {
    key:    'kenya',
    label:  'Pabari Kenya',
    flag:   '🇰🇪',
    desc:   'Tasks · Projects · Documents · Connect · Centre',
    accent: '#22c55e',
    href:   '/kenya',
    active: true,
    stat:   'Open workspace',
  },
  {
    key:    'india',
    label:  'Pabari India',
    flag:   '🇮🇳',
    desc:   'Tasks · Projects · Documents · Connect · Centre',
    accent: '#f97316',
    href:   null,
    active: false,
    stat:   'Coming soon',
  },
  {
    key:    'dubai',
    label:  'Pabari Dubai',
    flag:   '🇦🇪',
    desc:   'Tasks · Projects · Documents · Connect · Centre',
    accent: '#38bdf8',
    href:   null,
    active: false,
    stat:   'Coming soon',
  },
]

export default function PabariCoreBranches({ currentUser, mustChangePassword = false }: Props) {
  const [isMobile,    setIsMobile]    = useState(false)
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwCurrent,   setPwCurrent]   = useState('')
  const [pwNew,       setPwNew]       = useState('')
  const [pwConfirm,   setPwConfirm]   = useState('')
  const [pwLoading,   setPwLoading]   = useState(false)
  const [pwError,     setPwError]     = useState('')
  const [pwSuccess,   setPwSuccess]   = useState(false)

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

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'Inter,Arial,sans-serif', display: 'flex', flexDirection: 'column' }}>
      <InactivityGuard />

      {/* NAV */}
      <nav style={{ background: '#0f1a12', borderBottom: '1px solid #1e2e1a', padding: isMobile ? '0 16px' : '0 32px', display: 'flex', alignItems: 'center', height: 52, position: 'sticky', top: 0, zIndex: 50, gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 15, color: '#b5833a', letterSpacing: '0.15em' }}>PABARI</span>
          {!isMobile && <span style={{ fontSize: 9, color: '#4a7055', fontWeight: 700, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 4, padding: '2px 6px', letterSpacing: '0.06em' }}>WORKSPACE</span>}
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

      {/* PASSWORD CHANGE BANNER */}
      {mustChangePassword && !showPwModal && (
        <div style={{ background: '#7c2d12', color: 'white', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>🔐</span>
          <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>
            You&apos;re using a default password. Please set your own private password to keep your account secure.
          </span>
          <button
            onClick={() => { setShowPwModal(true); setPwCurrent(''); setPwNew(''); setPwConfirm(''); setPwError(''); setPwSuccess(false) }}
            style={{ background: 'white', color: '#7c2d12', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
            Change Password →
          </button>
        </div>
      )}

      {/* HERO */}
      <div style={{ background: 'linear-gradient(135deg, #0f1a12 0%, #1a2d1f 100%)', padding: isMobile ? '28px 16px 32px' : '40px 32px 44px', borderBottom: '1px solid #1e2e1a' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ fontSize: isMobile ? 11 : 12, fontWeight: 700, color: '#4a7055', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
            {getGreeting()}, {firstName}
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 26 : 38, fontWeight: 900, color: '#e2ede7', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Pabari Workspace
          </h1>
          <p style={{ margin: '8px 0 0', color: '#4a7055', fontSize: isMobile ? 12 : 13 }}>{fmtDate()}</p>
        </div>
      </div>

      {/* BRANCH GRID */}
      <div style={{ flex: 1, maxWidth: 900, margin: '0 auto', width: '100%', padding: isMobile ? '28px 16px 56px' : '44px 32px 72px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 22 }}>
          Select a Branch
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: isMobile ? 14 : 20 }}>
          {BRANCHES.map(branch => {
            const card = (
              <div
                style={{
                  background: 'white',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: isMobile ? '24px 20px' : '32px 26px',
                  cursor: branch.active ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  position: 'relative' as const,
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
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: branch.accent, borderRadius: '14px 14px 0 0' }} />
                <div style={{ fontSize: isMobile ? 38 : 50, marginBottom: 16, lineHeight: 1 }}>{branch.flag}</div>
                <div style={{ fontSize: isMobile ? 16 : 19, fontWeight: 800, color: '#0f172a', marginBottom: 5, letterSpacing: '-0.01em' }}>{branch.label}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20, lineHeight: 1.5 }}>{branch.desc}</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    color:      branch.active ? branch.accent : '#94a3b8',
                    background: branch.active ? `${branch.accent}18` : '#f1f5f9',
                    border:     `1px solid ${branch.active ? `${branch.accent}33` : '#e2e8f0'}`,
                    borderRadius: 20, padding: '4px 12px',
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
      </div>

      {/* PASSWORD CHANGE MODAL */}
      {showPwModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Change Password</h2>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: '#64748b' }}>Set a new secure password for your account.</p>
            {pwSuccess
              ? <div style={{ textAlign: 'center', padding: '16px 0', color: '#22c55e', fontWeight: 700 }}>✓ Password changed successfully!</div>
              : (
                <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {(['Current password', 'New password', 'Confirm new password'] as const).map((label, i) => {
                    const vals  = [pwCurrent, pwNew, pwConfirm]
                    const setters = [setPwCurrent, setPwNew, setPwConfirm]
                    return (
                      <div key={label}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>{label}</label>
                        <input type="password" value={vals[i]} onChange={e => setters[i](e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' as const }} required />
                      </div>
                    )
                  })}
                  {pwError && <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>{pwError}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button type="button" onClick={() => setShowPwModal(false)}
                      style={{ flex: 1, padding: '9px 0', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                      Cancel
                    </button>
                    <button type="submit" disabled={pwLoading}
                      style={{ flex: 1, padding: '9px 0', background: '#0f1a12', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 700, cursor: pwLoading ? 'wait' : 'pointer' }}>
                      {pwLoading ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              )}
          </div>
        </div>
      )}
    </div>
  )
}
