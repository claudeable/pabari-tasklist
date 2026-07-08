'use client'
import { useState, useEffect, useCallback } from 'react'
import { SessionUser } from '@/types'

interface ActivityEntry {
  id: number
  user_email: string
  user_name: string
  action: string
  details: string
  created_at: string
}

interface Props { currentUser: SessionUser }

const ACTION_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  login:                { label: 'Login',            color: '#16a34a', icon: '🟢' },
  logout:               { label: 'Logout',           color: '#6b7280', icon: '🔴' },
  task_created:         { label: 'Task Created',     color: '#2563eb', icon: '📋' },
  task_status_changed:  { label: 'Status Changed',   color: '#d97706', icon: '🔄' },
  task_commented:       { label: 'Task Comment',     color: '#7c3aed', icon: '💬' },
  task_legal_flagged:   { label: 'Legal Flagged',    color: '#dc2626', icon: '⚖️' },
  doc_uploaded:         { label: 'Doc Uploaded',     color: '#0891b2', icon: '📤' },
  doc_downloaded:       { label: 'Doc Downloaded',   color: '#64748b', icon: '📥' },
  doc_deleted:          { label: 'Doc Deleted',      color: '#dc2626', icon: '🗑' },
  doc_moved:            { label: 'Doc Moved',        color: '#d97706', icon: '📁' },
  doc_expiry_updated:   { label: 'Expiry Updated',   color: '#d97706', icon: '📅' },
  folder_created:       { label: 'Folder Created',   color: '#2563eb', icon: '📂' },
  folder_renamed:       { label: 'Folder Renamed',   color: '#d97706', icon: '✏️' },
  folder_deleted:       { label: 'Folder Deleted',   color: '#dc2626', icon: '🗑' },
  leave_submitted:      { label: 'Leave Submitted',  color: '#0891b2', icon: '📝' },
  leave_hr_approved:    { label: 'Leave HR Approved',color: '#16a34a', icon: '✅' },
  leave_hk_approved:    { label: 'Leave Approved',   color: '#16a34a', icon: '🎉' },
  leave_rejected:       { label: 'Leave Rejected',   color: '#dc2626', icon: '❌' },
  petty_cash_submitted: { label: 'Petty Cash Req',   color: '#0891b2', icon: '💵' },
  petty_cash_hos_approved:     { label: 'Petty Cash HOS ✓', color: '#16a34a', icon: '✅' },
  petty_cash_hod_approved:     { label: 'Petty Cash HOD ✓', color: '#16a34a', icon: '✅' },
  petty_cash_finance_approved: { label: 'Petty Cash Finance ✓', color: '#16a34a', icon: '✅' },
  petty_cash_approved:  { label: 'Petty Cash Approved', color: '#16a34a', icon: '🎉' },
  petty_cash_rejected:  { label: 'Petty Cash Rejected', color: '#dc2626', icon: '❌' },
}

function fmtDateTime(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function groupByDate(entries: ActivityEntry[]) {
  const groups: Record<string, ActivityEntry[]> = {}
  for (const e of entries) {
    const day = new Date(e.created_at).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
    if (!groups[day]) groups[day] = []
    groups[day].push(e)
  }
  return groups
}

export default function AuditLog({ currentUser }: Props) {
  const [entries,  setEntries]  = useState<ActivityEntry[]>([])
  const [loading,  setLoading]  = useState(true)
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to)   params.set('to', to)
    if (userFilter) params.set('user', userFilter)
    params.set('limit', '500')
    const res = await fetch(`/api/activity-log?${params}`, { credentials: 'include' })
    if (res.ok) setEntries(await res.json())
    setLoading(false)
  }, [from, to, userFilter])

  useEffect(() => { load() }, [load])

  const filtered = actionFilter
    ? entries.filter(e => e.action === actionFilter)
    : entries

  const groups = groupByDate(filtered)
  const uniqueUsers   = Array.from(new Set(entries.map(e => e.user_name))).sort()
  const uniqueActions = Array.from(new Set(entries.map(e => e.action))).sort()

  const inp: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 10px', fontSize: 12, outline: 'none', background: 'white' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', background: '#f9fafb' }}>

      {/* TOP NAV */}
      <div style={{ background: '#1a3a2a', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 50, flexShrink: 0 }}>
        <span style={{ background: '#b5833a', color: 'white', fontWeight: 800, fontSize: 11, padding: '4px 9px', borderRadius: 4, letterSpacing: '1px' }}>PABARI</span>
        <a href="/" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 12 }}>← Portal</a>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }}/>
        <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>Activity Log</span>
        <div style={{ flex: 1 }}/>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{currentUser.name}</span>
        <a href="/api/auth/logout" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 12 }}>Sign out</a>
      </div>

      {/* FILTERS */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '12px 24px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>FROM</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={inp}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>TO</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={inp}/>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>USER</label>
          <select value={userFilter} onChange={e => setUserFilter(e.target.value)} style={inp}>
            <option value="">All Users</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>ACTION</label>
          <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={inp}>
            <option value="">All Actions</option>
            {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>)}
          </select>
        </div>
        <button onClick={load} style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          Refresh
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* LOG */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {loading ? (
          <div style={{ color: '#9ca3af', fontSize: 14, padding: 20 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
            No activity found for the selected filters
          </div>
        ) : Object.entries(groups).map(([day, dayEntries]) => (
          <div key={day} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
              {day}
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              {dayEntries.map((e, i) => {
                const meta = ACTION_LABELS[e.action] || { label: e.action, color: '#6b7280', icon: '•' }
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 18px', borderBottom: i < dayEntries.length - 1 ? '1px solid #f3f4f6' : 'none' }}>

                    {/* Time */}
                    <div style={{ fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', marginTop: 2, minWidth: 50 }}>
                      {new Date(e.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>

                    {/* Icon */}
                    <div style={{ fontSize: 16, marginTop: 1, minWidth: 20, textAlign: 'center' }}>{meta.icon}</div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: '#111' }}>{e.user_name}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: `${meta.color}15`, borderRadius: 4, padding: '1px 7px' }}>
                          {meta.label}
                        </span>
                      </div>
                      {e.details && (
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{e.details}</div>
                      )}
                    </div>

                    {/* Full timestamp on hover hint */}
                    <div style={{ fontSize: 10, color: '#d1d5db', whiteSpace: 'nowrap', marginTop: 3 }}>
                      {fmtDateTime(e.created_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div style={{ background: '#1a3a2a', color: 'rgba(255,255,255,0.5)', fontSize: 10.5, padding: '5px 20px', display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>PABARI GROUP</span>
        <span>·</span><span>Activity Log</span>
        <span>·</span><span>Visible to admin and Harshil only</span>
      </div>
    </div>
  )
}
