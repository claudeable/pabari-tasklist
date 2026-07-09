'use client'
import { useState, useEffect, useCallback } from 'react'
import { SessionUser } from '@/types'

interface BlockedIP {
  id: number
  ip: string
  reason: string
  blocked_by: string
  blocked_at: string
  expires_at: string | null
  is_permanent: boolean
}

interface SecurityEvent {
  id: number
  event_type: string
  ip: string
  user_email: string
  details: string
  threat_score: number
  auto_blocked: boolean
  created_at: string
}

interface Stats {
  blockedIPs: number
  eventsToday: number
  highThreat: number
  autoBlockedToday: number
}

const EVENT_META: Record<string, { label: string; color: string; icon: string }> = {
  login_success:       { label: 'Login Success',     color: '#16a34a', icon: '✅' },
  login_failed:        { label: 'Login Failed',      color: '#dc2626', icon: '❌' },
  ip_rate_limited:     { label: 'Rate Limited',      color: '#d97706', icon: '⏱' },
  account_locked:      { label: 'Account Locked',    color: '#7c3aed', icon: '🔒' },
  ip_auto_blocked:     { label: 'Auto-Blocked',      color: '#dc2626', icon: '🚫' },
  blocked_ip_attempt:  { label: 'Blocked IP Hit',    color: '#dc2626', icon: '🛑' },
  manual_block:        { label: 'Manual Block',      color: '#b45309', icon: '🔨' },
  manual_unblock:      { label: 'Unblocked',         color: '#0891b2', icon: '🔓' },
}

function threatColor(score: number): string {
  if (score >= 70) return '#dc2626'
  if (score >= 40) return '#d97706'
  if (score >= 10) return '#ca8a04'
  return '#16a34a'
}

function fmtTime(s: string) {
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function SecurityDashboard({ currentUser }: { currentUser: SessionUser }) {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([])
  const [events,     setEvents]     = useState<SecurityEvent[]>([])
  const [stats,      setStats]      = useState<Stats>({ blockedIPs: 0, eventsToday: 0, highThreat: 0, autoBlockedToday: 0 })
  const [loading,    setLoading]    = useState(true)
  const [tab,        setTab]        = useState<'events' | 'blocked'>('events')
  const [blockForm,  setBlockForm]  = useState<{ ip: string; reason: string; hours: string } | null>(null)
  const [filterType, setFilterType] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/security', { credentials: 'include' })
    if (res.ok) {
      const data = await res.json()
      setBlockedIPs(data.blockedIPs || [])
      setEvents(data.events || [])
      setStats(data.stats || {})
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])

  async function handleBlock(ip: string, reason: string, hours?: number) {
    await fetch('/api/security/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'block', ip, reason, hours }),
    })
    setBlockForm(null)
    load()
  }

  async function handleUnblock(ip: string) {
    if (!confirm(`Unblock ${ip}?`)) return
    await fetch('/api/security/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'unblock', ip }),
    })
    load()
  }

  const displayedEvents = filterType
    ? events.filter(e => e.event_type === filterType)
    : events

  const uniqueTypes = Array.from(new Set(events.map(e => e.event_type))).sort()

  const card = (label: string, value: number | string, color: string, sub?: string) => (
    <div style={{ background: 'white', border: `1px solid ${color}30`, borderLeft: `4px solid ${color}`, borderRadius: 8, padding: '16px 20px', minWidth: 160 }}>
      <div style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: 'Inter,Arial,sans-serif', background: '#f9fafb' }}>

      {/* NAV */}
      <div style={{ background: '#1a1a2e', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 12, height: 50, flexShrink: 0 }}>
        <span style={{ background: '#dc2626', color: 'white', fontWeight: 800, fontSize: 11, padding: '4px 9px', borderRadius: 4, letterSpacing: '1px' }}>PABARI</span>
        <a href="/" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 12 }}>← Portal</a>
        <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>🛡 Security Centre</span>
        <div style={{ flex: 1 }} />
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Live · auto-refresh 30s</span>
        <button onClick={load} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 5, padding: '5px 12px', fontSize: 12, cursor: 'pointer' }}>↻ Refresh</button>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>{currentUser.name}</span>
      </div>

      <div style={{ flex: 1, padding: '24px', maxWidth: 1400, width: '100%', margin: '0 auto' }}>

        {/* STATS */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
          {card('Blocked IPs',       stats.blockedIPs,       '#dc2626', 'active blocks')}
          {card('Events Today',      stats.eventsToday,      '#2563eb', 'last 24 hours')}
          {card('High Threat',       stats.highThreat,       '#d97706', 'score ≥ 70 today')}
          {card('Auto-Blocked Today', stats.autoBlockedToday, '#7c3aed', 'by threat engine')}
        </div>

        {/* MANUAL BLOCK FORM */}
        {blockForm !== null && (
          <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Block IP Address</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>IP ADDRESS</div>
                <input value={blockForm.ip} onChange={e => setBlockForm({ ...blockForm, ip: e.target.value })}
                  placeholder="x.x.x.x" style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 10px', fontSize: 13, width: 160 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>REASON</div>
                <input value={blockForm.reason} onChange={e => setBlockForm({ ...blockForm, reason: e.target.value })}
                  placeholder="Reason for block" style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 10px', fontSize: 13, width: 240 }} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>DURATION (hours, blank = permanent)</div>
                <input value={blockForm.hours} onChange={e => setBlockForm({ ...blockForm, hours: e.target.value })}
                  placeholder="e.g. 24" type="number" min="1" style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 10px', fontSize: 13, width: 100 }} />
              </div>
              <button onClick={() => handleBlock(blockForm.ip, blockForm.reason, blockForm.hours ? Number(blockForm.hours) : undefined)}
                disabled={!blockForm.ip}
                style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Block IP
              </button>
              <button onClick={() => setBlockForm(null)}
                style={{ background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 5, padding: '8px 14px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* TABS */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', background: 'white', width: 'fit-content' }}>
          {(['events', 'blocked'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '10px 22px', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                background: tab === t ? '#1a1a2e' : 'white',
                color: tab === t ? 'white' : '#374151' }}>
              {t === 'events' ? `Events (${events.length})` : `Blocked IPs (${blockedIPs.length})`}
            </button>
          ))}
        </div>

        {/* EVENTS TAB */}
        {tab === 'events' && (
          <>
            <div style={{ display: 'flex', gap: 10, marginBottom: 14, alignItems: 'center' }}>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}
                style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 10px', fontSize: 12 }}>
                <option value="">All event types</option>
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{EVENT_META[t]?.label || t}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>{displayedEvents.length} events</span>
              <button onClick={() => setBlockForm({ ip: '', reason: '', hours: '24' })}
                style={{ marginLeft: 'auto', background: '#dc2626', color: 'white', border: 'none', borderRadius: 5, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Block IP
              </button>
            </div>

            {loading ? (
              <div style={{ color: '#9ca3af', padding: 20 }}>Loading…</div>
            ) : (
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                        {['Time', 'Event', 'IP', 'User', 'Details', 'Score', ''].map(h => (
                          <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayedEvents.map((e, i) => {
                        const meta = EVENT_META[e.event_type] || { label: e.event_type, color: '#6b7280', icon: '•' }
                        return (
                          <tr key={e.id} style={{ borderBottom: i < displayedEvents.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <td style={{ padding: '10px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtTime(e.created_at)}</td>
                            <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: meta.color, background: `${meta.color}15`, padding: '2px 8px', borderRadius: 4 }}>
                                {meta.icon} {meta.label}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12 }}>{e.ip || '—'}</td>
                            <td style={{ padding: '10px 14px', color: '#374151' }}>{e.user_email || '—'}</td>
                            <td style={{ padding: '10px 14px', color: '#6b7280', maxWidth: 280 }}>{e.details}</td>
                            <td style={{ padding: '10px 14px' }}>
                              {e.threat_score > 0 && (
                                <span style={{ fontWeight: 700, color: threatColor(e.threat_score), fontSize: 13 }}>
                                  {e.threat_score}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {e.ip && (
                                <button onClick={() => handleBlock(e.ip, `Flagged from security event`, 24)}
                                  style={{ fontSize: 11, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
                                  Block
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {displayedEvents.length === 0 && (
                        <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No events found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* BLOCKED IPs TAB */}
        {tab === 'blocked' && (
          <>
            <div style={{ display: 'flex', marginBottom: 14 }}>
              <button onClick={() => setBlockForm({ ip: '', reason: '', hours: '' })}
                style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Block IP
              </button>
            </div>
            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['IP Address', 'Reason', 'Blocked By', 'Blocked At', 'Expires', ''].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {blockedIPs.map((b, i) => (
                    <tr key={b.id} style={{ borderBottom: i < blockedIPs.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontWeight: 600, color: '#dc2626' }}>{b.ip}</td>
                      <td style={{ padding: '10px 14px', color: '#374151' }}>{b.reason}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                        <span style={{ fontSize: 11, background: b.blocked_by === 'system' ? '#fef3c7' : '#eff6ff', color: b.blocked_by === 'system' ? '#b45309' : '#1d4ed8', padding: '2px 7px', borderRadius: 4, fontWeight: 600 }}>
                          {b.blocked_by === 'system' ? '🤖 Auto' : `👤 ${b.blocked_by}`}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtTime(b.blocked_at)}</td>
                      <td style={{ padding: '10px 14px', color: '#6b7280' }}>
                        {b.is_permanent ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Permanent</span> : b.expires_at ? fmtTime(b.expires_at) : '—'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button onClick={() => handleUnblock(b.ip)}
                          style={{ fontSize: 11, background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: 4, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 }}>
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {blockedIPs.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No blocked IPs</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ background: '#1a1a2e', color: 'rgba(255,255,255,0.4)', fontSize: 11, padding: '5px 20px', display: 'flex', gap: 12 }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>PABARI GROUP</span>
        <span>·</span><span>Security Centre</span>
        <span>·</span><span>Admin access only</span>
        <span>·</span><span>Threat engine active</span>
      </div>
    </div>
  )
}
