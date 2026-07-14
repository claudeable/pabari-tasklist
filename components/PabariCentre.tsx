'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionUser } from '@/types'
import { NotifItem } from './NotificationBell'
import ChatPanel from './ChatPanel'

type Tab = 'inbox' | 'chat' | 'ai'
type Filter = 'all' | 'approval' | 'overdue' | 'task_assigned' | 'activity'

const FILTER_LABELS: Record<Filter, string> = {
  all:          'All',
  approval:     'Approvals',
  overdue:      'Overdue',
  task_assigned:'Tasks',
  activity:     'Activity',
}

const TYPE_COLOR: Record<string, string> = {
  approval:     '#f59e0b',
  overdue:      '#ef4444',
  task_assigned:'#3b82f6',
  activity:     '#8b5cf6',
}

const TYPE_LABEL: Record<string, string> = {
  approval:     'Approval needed',
  overdue:      'Overdue',
  task_assigned:'Assigned to you',
  activity:     'Activity',
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(ts).toLocaleDateString('en-GB', { day:'numeric', month:'short' })
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

export default function PabariCentre({ currentUser }: { currentUser: SessionUser }) {
  const [tab,      setTab]      = useState<Tab>('inbox')
  const [filter,   setFilter]   = useState<Filter>('all')
  const [items,    setItems]    = useState<NotifItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [isMobile, setIsMobile] = useState(false)

  const firstName = currentUser.name.split(' ')[0]
  const initials  = currentUser.name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadInbox = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/notifications', { credentials: 'include' })
      if (!r.ok) return
      const data = await r.json()
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadInbox() }, [loadInbox])

  const filtered = filter === 'all' ? items : items.filter(i => i.type === filter)
  const counts: Record<Filter, number> = {
    all:          items.length,
    approval:     items.filter(i => i.type === 'approval').length,
    overdue:      items.filter(i => i.type === 'overdue').length,
    task_assigned:items.filter(i => i.type === 'task_assigned').length,
    activity:     items.filter(i => i.type === 'activity').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui,-apple-system,sans-serif', display: 'flex', flexDirection: 'column' }}>

      {/* ── TOP NAV ──────────────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: isMobile ? '0 16px' : '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ background: '#b5833a', color: 'white', fontWeight: 800, fontSize: 11, padding: '5px 10px', borderRadius: 4, letterSpacing: '1px' }}>PABARI</div>
          </a>
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Centre</span>
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '2px 8px' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#15803d' }}>Live</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/tasks" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>Tasks</a>
          <a href="/" style={{ fontSize: 12, color: '#6b7280', textDecoration: 'none' }}>Portal</a>
          {!isMobile && <span style={{ fontSize: 13, color: '#374151' }}>{currentUser.name}</span>}
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a3a2a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials}</div>
          <button onClick={signOut} style={{ background: 'transparent', border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#374151', cursor: 'pointer' }}>
            {isMobile ? 'Out' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── LEFT SIDEBAR ──────────────────────────────────────────────────── */}
        {!isMobile && (
          <div style={{ width: 220, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '20px 16px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                {getGreeting()}, {firstName}
              </div>
            </div>
            {(
              [
                { key: 'inbox', icon: '📥', label: 'Inbox', badge: counts.all },
                { key: 'chat',  icon: '💬', label: 'Chat',  badge: 0 },
                { key: 'ai',    icon: '🤖', label: 'Pabari AI', badge: 0, soon: true },
              ] as { key: Tab; icon: string; label: string; badge: number; soon?: boolean }[]
            ).map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 16px', margin: '1px 8px', borderRadius: 8,
                  border: 'none', cursor: 'pointer', textAlign: 'left', width: 'calc(100% - 16px)',
                  background: tab === item.key ? '#f0fdf4' : 'transparent',
                  color: tab === item.key ? '#1a3a2a' : '#374151',
                  fontWeight: tab === item.key ? 700 : 400,
                  fontSize: 13, transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (tab !== item.key) (e.currentTarget as HTMLButtonElement).style.background = '#f9fafb' }}
                onMouseLeave={e => { if (tab !== item.key) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', fontSize: 10, fontWeight: 700, minWidth: 18, height: 18, padding: '0 4px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.badge}
                  </span>
                )}
                {item.soon && <span style={{ fontSize: 9, fontWeight: 700, background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 4 }}>SOON</span>}
              </button>
            ))}

            <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid #f3f4f6' }}>
              <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', padding: '8px 8px', borderRadius: 8, color: '#6b7280', fontSize: 12 }}
                onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#f9fafb'}
                onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
              >
                ← Back to Portal
              </a>
            </div>
          </div>
        )}

        {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: tab === 'chat' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Mobile tab bar */}
          {isMobile && (
            <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 8px' }}>
              {(['inbox', 'chat', 'ai'] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  style={{ flex: 1, padding: '12px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: tab === t ? 700 : 400, color: tab === t ? '#1a3a2a' : '#6b7280', borderBottom: `2px solid ${tab === t ? '#1a3a2a' : 'transparent'}` }}>
                  {t === 'inbox' ? '📥 Inbox' : t === 'chat' ? '💬 Chat' : '🤖 AI'}
                </button>
              ))}
            </div>
          )}

          {/* ── INBOX TAB ───────────────────────────────────────────────────── */}
          {tab === 'inbox' && (
            <div style={{ flex: 1, maxWidth: 800, padding: isMobile ? '12px' : '24px 32px' }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Inbox</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Everything that needs your attention, in one place.</p>
              </div>

              {/* Filter bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    style={{
                      padding: '5px 12px', borderRadius: 20, border: '1px solid',
                      borderColor: filter === f ? '#1a3a2a' : '#e5e7eb',
                      background: filter === f ? '#1a3a2a' : 'white',
                      color: filter === f ? 'white' : '#374151',
                      fontSize: 12, fontWeight: filter === f ? 700 : 400,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                    {FILTER_LABELS[f]}
                    {counts[f] > 0 && (
                      <span style={{ background: filter === f ? 'rgba(255,255,255,0.25)' : '#f3f4f6', borderRadius: 8, padding: '0 5px', fontSize: 10, fontWeight: 700 }}>
                        {counts[f]}
                      </span>
                    )}
                  </button>
                ))}
                <button onClick={loadInbox} style={{ marginLeft: 'auto', padding: '5px 10px', borderRadius: 20, border: '1px solid #e5e7eb', background: 'white', fontSize: 12, color: '#6b7280', cursor: 'pointer' }}>
                  ↻ Refresh
                </button>
              </div>

              {/* Items */}
              {loading ? (
                <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading inbox…</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>
                    {filter === 'all' ? 'Inbox is clear' : `No ${FILTER_LABELS[filter].toLowerCase()} items`}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>You're all caught up.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {filtered.map(item => {
                    const color = TYPE_COLOR[item.type] ?? '#6b7280'
                    const label = TYPE_LABEL[item.type] ?? item.type
                    return (
                      <a
                        key={item.id}
                        href={item.href}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 14,
                          padding: '14px 18px', background: 'white',
                          borderRadius: 10, border: '1px solid #e5e7eb',
                          textDecoration: 'none', transition: 'all 0.12s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = color; (e.currentTarget as HTMLAnchorElement).style.boxShadow = `0 2px 8px ${color}22` }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)' }}
                      >
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                          {item.icon}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', lineHeight: 1.4, marginBottom: 2 }}>{item.title}</div>
                          {item.detail && <div style={{ fontSize: 12, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.detail}</div>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, background: color + '18', color, borderRadius: 6, padding: '2px 7px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>{timeAgo(item.time)}</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CHAT TAB ────────────────────────────────────────────────────── */}
          {tab === 'chat' && (
            <ChatPanel currentUser={currentUser} />
          )}

          {/* ── AI TAB ──────────────────────────────────────────────────────── */}
          {tab === 'ai' && (
            <div style={{ flex: 1, maxWidth: 700, padding: isMobile ? '12px' : '24px 32px' }}>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>Pabari AI</h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>Your enterprise operating assistant.</p>
              </div>

              <div style={{ background: 'linear-gradient(135deg, #1a3a2a 0%, #2d5a40 100%)', borderRadius: 16, padding: '32px 28px', marginBottom: 16, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'white', marginBottom: 6 }}>Pabari AI</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', maxWidth: 380, margin: '0 auto 20px' }}>
                  The AI that understands your role, your work, and your organisation. Ask anything — from task summaries to procurement analytics.
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 16px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.05em' }}>COMING IN PHASE 3</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { icon: '📋', title: 'Personal Productivity', items: ['What do I need to finish today?', 'Show my overdue tasks', 'What changed while I was away?', 'Summarise my work'] },
                  { icon: '🔍', title: 'Search Everything', items: ['Find Invoice INV-2032', 'Search supplier agreements', 'Find procurement SOP', 'Open leave request #45'] },
                  { icon: '📊', title: 'Report Generator', items: ['Generate procurement report', 'Weekly finance summary', 'Monthly HR report', 'Export as PDF / Excel'] },
                  { icon: '⚡', title: 'Workflow Assistant', items: ['Create a leave request', 'Assign a task to Sarah', 'Draft supplier email', 'Schedule a meeting'] },
                ].map(card => (
                  <div key={card.title} style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 18 }}>{card.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{card.title}</span>
                    </div>
                    {card.items.map(i => (
                      <div key={i} style={{ fontSize: 11, color: '#6b7280', padding: '4px 0', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: '#d1d5db' }}>›</span> {i}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
