'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SessionUser } from '@/types'

// ── Types ──────────────────────────────────────────────────────────────────────
type Priority = 'Critical' | 'High' | 'Medium' | 'Low'
type EmailCategory = 'Finance' | 'Legal' | 'HR' | 'Procurement' | 'Logistics' | 'Projects' | 'IT' | 'Executive' | 'General'

interface Email {
  id:                 number
  zoho_message_id:    string
  from_email:         string
  from_name:          string
  subject:            string
  snippet:            string
  received_at:        string
  is_read:            boolean
  has_attachments:    boolean
  priority:           Priority | null
  category:           EmailCategory | null
  requires_action:    boolean
  deadline:           string | null
  summary:            string | null
  recommended_action: string | null
}

interface AccountStatus {
  connected:     boolean
  email?:        string
  data_center?:  string
  sync_status?:  string
  last_sync_at?: string
  error_message?:string
}

interface Stats {
  connected:       boolean
  today?:          { total:number; critical:number; high:number; unread:number; requires_action:number }
  unread_over_24h?:number
  critical_emails?:{ id:number; subject:string; from_name:string; summary:string; deadline:string }[]
}

// ── Priority colours ───────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<Priority, { bg: string; text: string; dot: string }> = {
  Critical: { bg: '#fef2f2', text: '#dc2626', dot: '#ef4444' },
  High:     { bg: '#fffbeb', text: '#d97706', dot: '#f59e0b' },
  Medium:   { bg: '#eff6ff', text: '#1d4ed8', dot: '#3b82f6' },
  Low:      { bg: '#f3f4f6', text: '#6b7280', dot: '#9ca3af' },
}

const CATEGORY_ICON: Record<string, string> = {
  Finance: '💰', Legal: '⚖️', HR: '👥', Procurement: '📦',
  Logistics: '🚚', Projects: '📋', IT: '💻', Executive: '👔', General: '📧',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d < 7 ? `${d}d ago` : new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
}

function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return null
  const c = PRIORITY_COLOR[priority]
  return (
    <span style={{ fontSize: 9, fontWeight: 800, background: c.bg, color: c.text, borderRadius: 5, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
      {priority}
    </span>
  )
}

// ── Connect prompt ─────────────────────────────────────────────────────────────
function ConnectPrompt({ onConnect, dc, setDc }: {
  onConnect: () => void
  dc: string
  setDc: (d: string) => void
}) {
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ textAlign: 'center', maxWidth: 440 }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>📧</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: '#111827' }}>Connect Zoho Mail</h2>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          Connect your Zoho Mail account to see important emails inside Pabari Centre, with AI analysis, priority triage, and one-click task creation.
        </p>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>Zoho Data Center</label>
          <select value={dc} onChange={e => setDc(e.target.value)}
            style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, background: 'white', cursor: 'pointer' }}>
            <option value="com">Global (zoho.com)</option>
            <option value="eu">Europe (zoho.eu)</option>
            <option value="in">India (zoho.in)</option>
            <option value="au">Australia (zoho.com.au)</option>
            <option value="jp">Japan (zoho.jp)</option>
          </select>
        </div>
        <button onClick={onConnect}
          style={{ width: '100%', background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 10, padding: '13px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Connect Zoho Mail →
        </button>
        <p style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
          Uses OAuth 2.0 · Your password is never stored · Emails remain in Zoho
        </p>
      </div>
    </div>
  )
}

// ── Email card ─────────────────────────────────────────────────────────────────
function EmailCard({
  email, selected, onSelect, onMarkRead, onArchive, onCreateTask, isMobile
}: {
  email: Email
  selected: boolean
  onSelect: () => void
  onMarkRead: () => void
  onArchive: () => void
  onCreateTask: () => void
  isMobile: boolean
}) {
  const p = email.priority ? PRIORITY_COLOR[email.priority] : null

  return (
    <div
      onClick={onSelect}
      style={{
        padding: isMobile ? '12px 14px' : '14px 20px',
        borderBottom: '1px solid #f3f4f6',
        background: selected ? '#f0fdf4' : email.is_read ? 'white' : '#fafffe',
        cursor: 'pointer',
        borderLeft: `3px solid ${p?.dot ?? '#e5e7eb'}`,
        transition: 'background 0.1s',
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Avatar / unread dot */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: p?.bg ?? '#f3f4f6', color: p?.text ?? '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
            {(email.from_name?.[0] ?? email.from_email?.[0] ?? '?').toUpperCase()}
          </div>
          {!email.is_read && (
            <div style={{ position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: '50%', background: '#1a3a2a', border: '2px solid white' }} />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontSize: 13, fontWeight: email.is_read ? 500 : 700, color: '#111827', flexShrink: 0 }}>
              {email.from_name || email.from_email}
            </span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{timeAgo(email.received_at)}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: email.is_read ? 400 : 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {email.subject}
            </span>
            <PriorityBadge priority={email.priority} />
          </div>

          {email.summary ? (
            <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {CATEGORY_ICON[email.category ?? 'General'] ?? '📧'} {email.summary}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {email.snippet}
            </div>
          )}

          {/* Deadline / action badges */}
          {(email.requires_action || (email.deadline && email.deadline !== 'None')) && (
            <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
              {email.requires_action && (
                <span style={{ fontSize: 10, fontWeight: 700, background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '2px 6px' }}>
                  Action Required
                </span>
              )}
              {email.deadline && email.deadline !== 'None' && (
                <span style={{ fontSize: 10, fontWeight: 600, background: '#fffbeb', color: '#d97706', borderRadius: 4, padding: '2px 6px' }}>
                  ⏰ {email.deadline}
                </span>
              )}
              {email.has_attachments && (
                <span style={{ fontSize: 10, color: '#6b7280' }}>📎</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions (shown on hover/selection) */}
      {selected && (
        <div style={{ display: 'flex', gap: 6, marginTop: 10, paddingTop: 10, borderTop: '1px solid #e5e7eb' }} onClick={e => e.stopPropagation()}>
          {!email.is_read && (
            <ActionBtn onClick={onMarkRead} color="#1a3a2a">✓ Mark Read</ActionBtn>
          )}
          <ActionBtn onClick={onCreateTask} color="#1d4ed8">+ Create Task</ActionBtn>
          <ActionBtn onClick={onArchive} color="#6b7280">Archive</ActionBtn>
          {email.recommended_action && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6b7280', alignSelf: 'center' }}>
              AI: {email.recommended_action}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '5px 11px', borderRadius: 6, border: `1px solid ${color}20`, background: `${color}10`, color, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
      {children}
    </button>
  )
}

// ── Main MailInbox component ───────────────────────────────────────────────────
export default function MailInbox({ currentUser }: { currentUser: SessionUser }) {
  const [account,     setAccount]     = useState<AccountStatus | null>(null)
  const [emails,      setEmails]      = useState<Email[]>([])
  const [total,       setTotal]       = useState(0)
  const [page,        setPage]        = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [syncing,     setSyncing]     = useState(false)
  const [selected,    setSelected]    = useState<number | null>(null)
  const [filter,      setFilter]      = useState<'all' | 'unread' | 'critical' | 'action'>('all')
  const [dc,          setDc]          = useState('com')
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [showTimeline,setShowTimeline]= useState(false)
  const [timelineData,setTimelineData]= useState<{ id:number; hour:string; from:string; summary:string; priority:string; is_read:boolean }[]>([])
  const [taskCreating,setTaskCreating]= useState<number | null>(null)
  const [taskDone,    setTaskDone]    = useState<number | null>(null)
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

  // Load account status
  const loadAccount = useCallback(async () => {
    const r = await fetch('/api/mail/account', { credentials: 'include' })
    if (r.ok) setAccount(await r.json())
  }, [])

  // Load emails
  const loadEmails = useCallback(async (reset = true) => {
    if (!account?.connected) return
    if (reset) setLoading(true)
    const p = new URLSearchParams({ page: reset ? '1' : String(page + 1) })
    if (filter === 'unread') p.set('unread', 'true')
    if (filter === 'critical') p.set('priority', 'Critical')
    if (filter === 'action') p.set('unread', 'true')

    const r = await fetch(`/api/mail/emails?${p}`, { credentials: 'include' })
    if (r.ok) {
      const data = await r.json()
      if (reset) {
        setEmails(data.emails ?? [])
        setPage(1)
      } else {
        setEmails(prev => [...prev, ...(data.emails ?? [])])
        setPage(p => p + 1)
      }
      setTotal(data.total ?? 0)
    }
    setLoading(false)
  }, [account, filter, page])

  // Load stats
  const loadStats = useCallback(async () => {
    if (!account?.connected) return
    const r = await fetch('/api/mail/stats', { credentials: 'include' })
    if (r.ok) setStats(await r.json())
  }, [account])

  useEffect(() => { loadAccount() }, [loadAccount])
  useEffect(() => {
    if (account?.connected) { loadEmails(); loadStats() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, filter])

  // Auto-sync every 2 minutes when tab is active
  const syncRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => {
    if (!account?.connected) return
    syncRef.current = setInterval(() => {
      fetch('/api/mail/sync', { method: 'POST', credentials: 'include' })
        .then(() => { loadEmails(); loadStats() })
        .catch(() => {})
    }, 2 * 60 * 1000)
    return () => { if (syncRef.current) clearInterval(syncRef.current) }
  }, [account, loadEmails, loadStats])

  async function handleManualSync() {
    setSyncing(true)
    await fetch('/api/mail/sync', { method: 'POST', credentials: 'include' }).catch(() => {})
    await Promise.all([loadEmails(), loadStats()])
    setSyncing(false)
  }

  async function handleMarkRead(emailId: number) {
    await fetch(`/api/mail/emails/${emailId}/read`, { method: 'POST', credentials: 'include' })
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, is_read: true } : e))
  }

  async function handleArchive(emailId: number) {
    await fetch(`/api/mail/emails/${emailId}/archive`, { method: 'POST', credentials: 'include' })
    setEmails(prev => prev.filter(e => e.id !== emailId))
  }

  async function handleCreateTask(emailId: number) {
    setTaskCreating(emailId)
    const r = await fetch(`/api/mail/emails/${emailId}/create-task`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responsible: currentUser.name }),
    })
    setTaskCreating(null)
    if (r.ok) {
      setTaskDone(emailId)
      setTimeout(() => setTaskDone(null), 3000)
      window.open('/tasks', '_blank')
    }
  }

  async function loadTimeline() {
    const r = await fetch('/api/mail/timeline', { credentials: 'include' })
    if (r.ok) {
      const data = await r.json()
      setTimelineData(data.events ?? [])
      setShowTimeline(true)
    }
  }

  const FILTERS = [
    { key: 'all',      label: 'All' },
    { key: 'unread',   label: 'Unread' },
    { key: 'critical', label: '🔴 Critical' },
    { key: 'action',   label: '⚡ Action' },
  ]

  // Not connected
  if (account && !account.connected) {
    return <ConnectPrompt onConnect={() => window.location.href = `/api/mail/oauth/authorize?dc=${dc}`} dc={dc} setDc={setDc} />
  }

  // Loading initial state
  if (!account) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>Loading…</div>
  }

  if (account.sync_status === 'error') {
    return (
      <div style={{ padding: 32, maxWidth: 500 }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>⚠️ Sync Error</div>
          <div style={{ fontSize: 13, color: '#374151' }}>{account.error_message}</div>
        </div>
        <button onClick={() => window.location.href = `/api/mail/oauth/authorize?dc=${account.data_center ?? 'com'}`}
          style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Reconnect Zoho Mail
        </button>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Stats bar ─────────────────────────────────────────────────────────── */}
      {stats?.today && (
        <div style={{ padding: isMobile ? '10px 12px' : '10px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <StatChip label="Today" value={stats.today.total} color="#6b7280" />
          <StatChip label="Critical" value={stats.today.critical} color="#dc2626" />
          <StatChip label="Unread" value={stats.today.unread} color="#1d4ed8" />
          <StatChip label="Action" value={stats.today.requires_action} color="#d97706" />
          {(stats.unread_over_24h ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: '#dc2626', marginLeft: 4 }}>⚠️ {stats.unread_over_24h} unread 24h+</span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {account.last_sync_at ? `Synced ${timeAgo(account.last_sync_at)}` : 'Never synced'}
            </span>
            <button onClick={loadTimeline}
              style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #e5e7eb', borderRadius: 6, background: 'white', cursor: 'pointer', color: '#374151' }}>
              Timeline
            </button>
            <button onClick={handleManualSync} disabled={syncing}
              style={{ fontSize: 11, padding: '4px 10px', border: '1px solid #1a3a2a', borderRadius: 6, background: syncing ? '#f3f4f6' : '#1a3a2a', color: syncing ? '#9ca3af' : 'white', cursor: syncing ? 'wait' : 'pointer' }}>
              {syncing ? '…' : '↻ Sync'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filter tabs ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, padding: '0 12px', background: 'white', borderBottom: '1px solid #e5e7eb', overflowX: 'auto' }}>
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
            style={{ padding: '10px 16px', border: 'none', borderBottom: filter === f.key ? '2px solid #1a3a2a' : '2px solid transparent', background: 'transparent', fontSize: 12, fontWeight: filter === f.key ? 700 : 400, color: filter === f.key ? '#1a3a2a' : '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {f.label}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', padding: '0 4px' }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{total} emails</span>
        </div>
      </div>

      {/* ── Email list ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading emails…</div>
        ) : emails.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
            <div style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>No emails</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              {filter === 'all' ? 'Your inbox is clear.' : `No ${filter} emails.`}
            </div>
          </div>
        ) : (
          <>
            {emails.map(email => (
              <EmailCard
                key={email.id}
                email={email}
                selected={selected === email.id}
                isMobile={isMobile}
                onSelect={() => {
                  setSelected(selected === email.id ? null : email.id)
                  if (!email.is_read) handleMarkRead(email.id)
                }}
                onMarkRead={() => handleMarkRead(email.id)}
                onArchive={() => handleArchive(email.id)}
                onCreateTask={() => handleCreateTask(email.id)}
              />
            ))}

            {taskDone !== null && (
              <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#1a3a2a', color: 'white', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 99, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                ✓ Task created — <a href="/tasks" target="_blank" style={{ color: '#86efac', textDecoration: 'underline' }}>View in Tasks</a>
              </div>
            )}
            {taskCreating !== null && (
              <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#374151', color: 'white', padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 99 }}>
                Creating task…
              </div>
            )}

            {emails.length < total && (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <button onClick={() => loadEmails(false)}
                  style={{ padding: '8px 24px', border: '1px solid #e5e7eb', borderRadius: 8, background: 'white', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
                  Load more ({total - emails.length} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Disconnect link ───────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>📧 {account.email}</span>
        <button onClick={async () => {
          if (!confirm('Disconnect Zoho Mail?')) return
          await fetch('/api/mail/account', { method: 'DELETE', credentials: 'include' })
          setAccount({ connected: false })
        }} style={{ marginLeft: 'auto', fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>
          Disconnect
        </button>
      </div>

      {/* ── Timeline modal ────────────────────────────────────────────────────── */}
      {showTimeline && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => e.target === e.currentTarget && setShowTimeline(false)}>
          <div style={{ width: '100%', maxWidth: 560, maxHeight: '80vh', background: 'white', borderRadius: '16px 16px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>📅 Executive Email Timeline</span>
              <button onClick={() => setShowTimeline(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {timelineData.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No emails today</div>
              ) : (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {timelineData.map((ev, i) => (
                    <div key={ev.id} style={{ display: 'flex', gap: 16, paddingBottom: 16, borderLeft: '2px solid #e5e7eb', marginLeft: 20, paddingLeft: 20, position: 'relative' }}>
                      <div style={{ position: 'absolute', left: -5, top: 4, width: 8, height: 8, borderRadius: '50%', background: ev.priority === 'Critical' ? '#ef4444' : ev.priority === 'High' ? '#f59e0b' : '#6b7280', border: '2px solid white' }} />
                      <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, width: 36, fontFamily: 'monospace' }}>{ev.hour}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{ev.from}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{ev.summary}</div>
                        {ev.priority === 'Critical' && <span style={{ fontSize: 9, background: '#fef2f2', color: '#dc2626', borderRadius: 4, padding: '1px 5px', fontWeight: 700 }}>CRITICAL</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 11, color: '#6b7280' }}>{label}:</span>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

