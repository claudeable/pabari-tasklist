'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

export interface NotifItem {
  id:     string
  type:   'approval' | 'task_assigned' | 'overdue' | 'activity'
  title:  string
  detail: string
  href:   string
  time:   string
  icon:   string
}

const TYPE_META: Record<string, { label: string; color: string }> = {
  approval:     { label: 'Approvals Needed',    color: '#f59e0b' },
  overdue:      { label: 'Overdue Tasks',        color: '#ef4444' },
  task_assigned:{ label: 'Recent Assignments',   color: '#3b82f6' },
  activity:     { label: 'Recent Activity',      color: '#8b5cf6' },
}

const TYPE_ORDER = ['approval', 'overdue', 'task_assigned', 'activity']

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function NotificationBell({ userEmail }: { userEmail: string }) {
  const [open,    setOpen]    = useState(false)
  const [items,   setItems]   = useState<NotifItem[]>([])
  const [unread,  setUnread]  = useState(0)
  const [loading, setLoading] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const SEEN_KEY = `pabari_notif_${userEmail}`

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/notifications', { credentials: 'include' })
      if (!r.ok) return
      const data = await r.json()
      const list: NotifItem[] = data.items ?? []
      setItems(list)
      const lastSeen = parseInt(localStorage.getItem(SEEN_KEY) ?? '0', 10)
      setUnread(list.filter(i => new Date(i.time).getTime() > lastSeen).length)
    } finally {
      setLoading(false)
    }
  }, [SEEN_KEY])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, 2 * 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  function handleBell() {
    const next = !open
    setOpen(next)
    if (next) {
      setUnread(0)
      localStorage.setItem(SEEN_KEY, String(Date.now()))
    }
  }

  const grouped = TYPE_ORDER.map(t => ({
    type: t,
    meta: TYPE_META[t],
    list: items.filter(i => i.type === t),
  })).filter(g => g.list.length > 0)

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={handleBell}
        title="Notifications"
        style={{
          position: 'relative',
          background: open ? '#f0fdf4' : 'transparent',
          border: `1px solid ${open ? '#86efac' : '#e5e7eb'}`,
          borderRadius: 8,
          width: 36, height: 36,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 16, transition: 'all 0.15s',
        }}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -5,
            background: '#ef4444', color: 'white',
            fontSize: 9, fontWeight: 800,
            minWidth: 17, height: 17, padding: '0 3px',
            borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white', lineHeight: 1,
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div style={{
          position: 'fixed',
          top: 52, right: 0,
          width: 380,
          height: 'calc(100vh - 52px)',
          background: 'white',
          borderLeft: '1px solid #e5e7eb',
          boxShadow: '-6px 0 24px rgba(0,0,0,0.08)',
          zIndex: 200,
          display: 'flex', flexDirection: 'column',
          fontFamily: 'system-ui,-apple-system,sans-serif',
        }}>
          {/* Drawer header */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid #f3f4f6',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'white', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>Notifications</div>
              {!loading && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                  {items.length === 0 ? 'Nothing pending' : `${items.length} item${items.length !== 1 ? 's' : ''}`}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <a
                href="/centre"
                style={{ fontSize: 11, fontWeight: 700, color: '#1a3a2a', textDecoration: 'none', background: '#f0fdf4', border: '1px solid #86efac', padding: '4px 10px', borderRadius: 6, letterSpacing: '0.02em' }}
              >
                Pabari Centre →
              </a>
              <button
                onClick={() => setOpen(false)}
                style={{ background: '#f3f4f6', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Drawer body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
            ) : items.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>All caught up</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>No pending notifications</div>
              </div>
            ) : (
              grouped.map(({ type, meta, list }) => (
                <div key={type}>
                  <div style={{
                    padding: '10px 16px 4px',
                    fontSize: 10, fontWeight: 800, color: meta.color,
                    textTransform: 'uppercase', letterSpacing: '0.09em',
                    background: '#fafafa', borderBottom: '1px solid #f3f4f6',
                  }}>
                    {meta.label}
                  </div>
                  {list.map((item, idx) => (
                    <a
                      key={item.id}
                      href={item.href}
                      style={{
                        display: 'flex', gap: 11, padding: '11px 16px',
                        borderBottom: idx < list.length - 1 ? '1px solid #f9fafb' : '1px solid #f3f4f6',
                        textDecoration: 'none', background: 'white', transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = '#f9fafb'}
                      onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'white'}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: meta.color + '18',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, flexShrink: 0,
                      }}>
                        {item.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', lineHeight: 1.4 }}>{item.title}</div>
                        {item.detail && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.detail}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 3 }}>{timeAgo(item.time)}</div>
                      </div>
                    </a>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', flexShrink: 0, background: '#fafafa' }}>
            <a
              href="/centre"
              style={{ display: 'block', textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#1a3a2a', textDecoration: 'none', padding: '7px', borderRadius: 8, background: 'white', border: '1px solid #e5e7eb' }}
            >
              Open Pabari Centre — Full Inbox
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
