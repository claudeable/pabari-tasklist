'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'

interface ActivityEntry {
  id: number
  user_name: string
  action: string
  details: string
  created_at: string
}

const ACTION_LABELS: Record<string, { label: string; dot: string }> = {
  login:               { label: 'Logged in',          dot: '#15803d' },
  logout:              { label: 'Logged out',          dot: '#6b7280' },
  task_created:        { label: 'Created task',        dot: '#1d4ed8' },
  task_status_changed: { label: 'Changed task status', dot: '#b45309' },
  task_commented:      { label: 'HK commented',        dot: '#7c3aed' },
  task_update_posted:  { label: 'Posted update',       dot: '#0891b2' },
  leave_submitted:     { label: 'Submitted leave',     dot: '#b5833a' },
  pcr_submitted:       { label: 'Submitted petty cash',dot: '#b5833a' },
  leave_approved:      { label: 'Approved leave',      dot: '#15803d' },
  leave_rejected:      { label: 'Rejected leave',      dot: '#dc2626' },
}

interface Props {
  currentUser: SessionUser
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

const systems = [
  {
    key: 'tasks',
    icon: '✓',
    iconBg: '#dbeafe',
    iconColor: '#1d4ed8',
    label: 'Task Management',
    description: 'Assign, track, and manage tasks across all group entities.',
    badge: 'Live',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    href: '/tasks',
    detail: 'Pending lists · Assignments · Deadlines',
  },
  {
    key: 'forms',
    icon: '📋',
    iconBg: '#fef3c7',
    iconColor: '#b45309',
    label: 'Forms',
    description: 'Digital forms for leave requests and petty cash requisitions.',
    badge: 'Live',
    badgeBg: '#dcfce7',
    badgeColor: '#15803d',
    href: '/forms',
    detail: 'Leave Requests · Petty Cash',
  },
  {
    key: 'docs',
    icon: '📁',
    iconBg: '#f3e8ff',
    iconColor: '#7c3aed',
    label: 'Document Management',
    description: 'Centralised document storage and management for all entities.',
    badge: 'Coming Soon',
    badgeBg: '#f3f4f6',
    badgeColor: '#6b7280',
    href: null,
    detail: 'All entities · Version control · Expiry tracking',
  },
]

export default function PortalHub({ currentUser }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  const [pendingForms, setPendingForms] = useState(0)
  const firstName = currentUser.name.split(' ')[0]

  const isDirector = currentUser.role === 'director' || currentUser.role === 'admin'

  // Activity log state (directors/admin only)
  const [activityLog,   setActivityLog]   = useState<ActivityEntry[]>([])
  const [activityFrom,  setActivityFrom]  = useState('')
  const [activityTo,    setActivityTo]    = useState('')
  const [activityUser,  setActivityUser]  = useState('')
  const [activityLoading, setActivityLoading] = useState(false)
  const [allUserNames,  setAllUserNames]  = useState<string[]>([])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/forms/pending-count')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPendingForms(d.total) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isDirector) return
    fetch('/api/users', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllUserNames(data.map((u: { name: string }) => u.name).sort()) })
      .catch(() => {})
    fetchActivity()
  }, [isDirector])

  function fetchActivity() {
    if (!isDirector) return
    setActivityLoading(true)
    const params = new URLSearchParams({ limit: '200' })
    if (activityFrom) params.set('from', activityFrom)
    if (activityTo)   params.set('to', activityTo)
    if (activityUser) params.set('user', activityUser)
    fetch(`/api/activity-log?${params}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setActivityLog(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setActivityLoading(false))
  }

  function fmtTs(ts: string) {
    const d = new Date(ts)
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: 'white', borderBottom: '1px solid #e5e7eb',
        padding: isMobile ? '14px 16px' : '16px 40px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            background: '#b5833a', color: 'white', fontWeight: 800,
            fontSize: 11, padding: '5px 10px', borderRadius: 4, letterSpacing: '1px',
          }}>PABARI</div>
          {!isMobile && (
            <span style={{ fontSize: 13, color: '#6b7280' }}>platform.pabari.com</span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {!isMobile && (
            <span style={{ fontSize: 13, color: '#374151' }}>
              {currentUser.name} · {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
            </span>
          )}
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#1a3a2a', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
          }}>
            {currentUser.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
          </div>
          <button
            onClick={signOut}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid #d1d5db',
              borderRadius: 6, padding: '7px 13px', fontSize: 13,
              color: '#374151', cursor: 'pointer',
            }}
          >
            {isMobile ? 'Out' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '32px 16px' : '52px 40px' }}>

        {/* Greeting */}
        <div style={{ marginBottom: pendingForms > 0 ? 20 : 40 }}>
          <h1 style={{ fontSize: isMobile ? 26 : 32, fontWeight: 700, color: '#111827', margin: 0, marginBottom: 8 }}>
            {getGreeting()}, {firstName}
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', margin: 0 }}>
            Select a system to continue.
          </p>
        </div>

        {/* Pending approval banner */}
        {pendingForms > 0 && (
          <div
            onClick={() => { window.location.href = '/forms' }}
            style={{
              marginBottom: 32, padding: '14px 20px',
              background: '#fffbeb', border: '1px solid #f59e0b',
              borderRadius: 10, display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', cursor: 'pointer',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: '#fef3c7', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: 18, flexShrink: 0,
              }}>🔔</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>
                  {pendingForms} request{pendingForms !== 1 ? 's' : ''} pending your approval
                </div>
                <div style={{ fontSize: 12, color: '#b45309', marginTop: 2 }}>
                  Go to Forms to review and action them
                </div>
              </div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#b45309', whiteSpace: 'nowrap' }}>
              Review →
            </span>
          </div>
        )}

        {/* System cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 20,
        }}>
          {systems.map(sys => {
            const isDisabled = !sys.href
            return (
              <div
                key={sys.key}
                onClick={() => { if (sys.href) window.location.href = sys.href }}
                style={{
                  background: 'white',
                  border: `2px solid ${isDisabled ? '#e5e7eb' : '#e5e7eb'}`,
                  borderRadius: 12,
                  padding: 28,
                  cursor: isDisabled ? 'default' : 'pointer',
                  opacity: isDisabled ? 0.65 : 1,
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  position: 'relative',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
                onMouseEnter={e => {
                  if (!isDisabled) {
                    (e.currentTarget as HTMLDivElement).style.borderColor = '#1a3a2a'
                    ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)'
                  }
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#e5e7eb'
                  ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.06)'
                }}
              >
                {/* Badge */}
                <div style={{ position: 'absolute', top: 20, right: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {sys.key === 'forms' && pendingForms > 0 && (
                    <span style={{
                      background: '#ef4444', color: 'white',
                      fontSize: 11, fontWeight: 700, minWidth: 20, height: 20,
                      padding: '0 6px', borderRadius: 10, display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {pendingForms}
                    </span>
                  )}
                  <span style={{
                    background: sys.badgeBg, color: sys.badgeColor,
                    fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
                  }}>
                    {sys.badge === 'Live' && <span style={{ marginRight: 4 }}>●</span>}
                    {sys.badge}
                  </span>
                </div>

                {/* Icon */}
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: sys.iconBg,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, marginBottom: 18,
                }}>
                  {sys.icon}
                </div>

                <div style={{ fontSize: 17, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
                  {sys.label}
                </div>
                <div style={{ fontSize: 13.5, color: '#6b7280', marginBottom: 16, lineHeight: 1.55 }}>
                  {sys.description}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
                  {sys.detail}
                </div>
              </div>
            )
          })}
        </div>

        {/* Activity Log — directors only */}
        {isDirector && (
          <div style={{ marginTop: 40 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>Activity Log</div>
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>User activity trail — visible to directors only</div>
              </div>
            </div>

            {/* Filters */}
            <div style={{ background: 'white', borderRadius: 8, padding: '12px 16px', marginBottom: 12, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb' }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>From</div>
                <input type="date" value={activityFrom} onChange={e => setActivityFrom(e.target.value)}
                  style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '5px 8px', fontSize: 12 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>To</div>
                <input type="date" value={activityTo} onChange={e => setActivityTo(e.target.value)}
                  style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '5px 8px', fontSize: 12 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>User</div>
                <select value={activityUser} onChange={e => setActivityUser(e.target.value)}
                  style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '5px 8px', fontSize: 12, color: '#374151' }}>
                  <option value="">All Users</option>
                  {allUserNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <button onClick={fetchActivity}
                style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-end' }}>
                {activityLoading ? 'Loading…' : 'Filter'}
              </button>
              <button onClick={() => { setActivityFrom(''); setActivityTo(''); setActivityUser('') }}
                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, padding: '6px 12px', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-end' }}>
                Reset
              </button>
            </div>

            {/* Log list */}
            <div style={{ background: 'white', borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #e5e7eb', maxHeight: 480, overflowY: 'auto' }}>
              {activityLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
              ) : activityLog.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No activity recorded yet.</div>
              ) : activityLog.map((entry, i) => {
                const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, dot: '#9ca3af' }
                return (
                  <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 16px', borderBottom: i < activityLog.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.dot, flexShrink: 0, marginTop: 5 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: '#111827' }}>{entry.user_name}</span>
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{meta.label}</span>
                      </div>
                      {entry.details && (
                        <div style={{ fontSize: 11, color: '#374151', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                          {entry.details}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {fmtTs(entry.created_at)}
                    </span>
                  </div>
                )
              })}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, textAlign: 'right' }}>{activityLog.length} entries shown</div>
          </div>
        )}

        {/* Footer note */}
        <div style={{
          marginTop: 32, padding: '14px 20px',
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          borderRadius: 8, fontSize: 13, color: '#15803d',
        }}>
          <strong>Pabari Group Portal</strong> — Task Management and Forms are live.
          Document Management is coming soon.
        </div>
      </div>

    </div>
  )
}
