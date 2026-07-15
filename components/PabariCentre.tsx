'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SessionUser } from '@/types'
import { NotifItem } from './NotificationBell'
import ChatPanel from './ChatPanel'

type Tab = 'inbox' | 'chat' | 'ai'

interface AiMessage { role: 'user' | 'assistant'; content: string }

const AI_SUGGESTIONS = [
  'What do I need to finish today?',
  'Show my overdue tasks',
  'Do I have any pending approvals?',
  'What changed while I was away?',
]

function AiTab({ currentUser }: { currentUser: SessionUser }) {
  const [messages, setMessages]     = useState<AiMessage[]>([])
  const [input,    setInput]        = useState('')
  const [loading,  setLoading]      = useState(false)
  const [error,    setError]        = useState('')
  const [started,  setStarted]      = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const firstName = currentUser.name.split(' ')[0]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setStarted(true)
    setError('')
    const next: AiMessage[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages(next)
    setInput('')
    setLoading(true)
    const placeholder: AiMessage = { role: 'assistant', content: '' }
    setMessages([...next, placeholder])

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: next }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error ?? `Error ${res.status}`)
      }
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let full = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        full += decoder.decode(value, { stream: true })
        setMessages([...next, { role: 'assistant', content: full }])
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      setError(msg)
      setMessages(next)
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  /* ── Render message content with basic markdown-ish formatting ── */
  function renderContent(text: string) {
    const lines = text.split('\n')
    return lines.map((line, i) => {
      if (line.startsWith('## '))  return <div key={i} style={{ fontWeight: 800, fontSize: 13, color: '#111827', marginTop: 10, marginBottom: 2 }}>{line.slice(3)}</div>
      if (line.startsWith('# '))   return <div key={i} style={{ fontWeight: 800, fontSize: 15, color: '#111827', marginTop: 8, marginBottom: 2 }}>{line.slice(2)}</div>
      if (line.startsWith('- ') || line.startsWith('• ')) {
        const content = line.slice(2)
        // linkify /path references
        const parts = content.split(/(\[.*?\]\(.*?\)|\/\w[\w/-]*)/g)
        return (
          <div key={i} style={{ display: 'flex', gap: 6, paddingLeft: 4, marginBottom: 2 }}>
            <span style={{ color: '#9ca3af', flexShrink: 0 }}>•</span>
            <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
              {parts.map((p, j) => {
                const mdLink = p.match(/^\[(.*?)\]\((.*?)\)$/)
                if (mdLink) return <a key={j} href={mdLink[2]} style={{ color: '#1a3a2a', fontWeight: 600, textDecoration: 'underline' }}>{mdLink[1]}</a>
                if (/^\/\w/.test(p)) return <a key={j} href={p} style={{ color: '#1a3a2a', fontWeight: 600, textDecoration: 'underline' }}>{p}</a>
                return p
              })}
            </span>
          </div>
        )
      }
      if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
      const parts = line.split(/(\[.*?\]\(.*?\)|\/\w[\w/-]*|\*\*.*?\*\*)/g)
      return (
        <div key={i} style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginBottom: 1 }}>
          {parts.map((p, j) => {
            const mdLink = p.match(/^\[(.*?)\]\((.*?)\)$/)
            if (mdLink) return <a key={j} href={mdLink[2]} style={{ color: '#1a3a2a', fontWeight: 600, textDecoration: 'underline' }}>{mdLink[1]}</a>
            if (/^\/\w/.test(p)) return <a key={j} href={p} style={{ color: '#1a3a2a', fontWeight: 600, textDecoration: 'underline' }}>{p}</a>
            const bold = p.match(/^\*\*(.*?)\*\*$/)
            if (bold) return <strong key={j}>{bold[1]}</strong>
            return p
          })}
        </div>
      )
    })
  }

  if (!started) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🤖</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6 }}>Pabari AI</div>
          <div style={{ fontSize: 13, color: '#6b7280', maxWidth: 340, lineHeight: 1.6 }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}. Ask me anything about your work.
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, width: '100%', maxWidth: 460 }}>
          {AI_SUGGESTIONS.map(s => (
            <button key={s} onClick={() => send(s)}
              style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', textAlign: 'left', fontSize: 12, color: '#374151', lineHeight: 1.4, transition: 'border-color 0.1s' }}
              onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#1a3a2a'}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.borderColor = '#e5e7eb'}
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: 560 }}>
          <AiInput inputRef={inputRef} input={input} setInput={setInput} loading={loading} onSend={() => send(input)} onKey={handleKey} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 8px' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'user' ? (
                <div style={{ background: '#1a3a2a', color: 'white', borderRadius: '16px 16px 4px 16px', padding: '10px 16px', maxWidth: '80%', fontSize: 13, lineHeight: 1.5 }}>
                  {m.content}
                </div>
              ) : (
                <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '4px 16px 16px 16px', padding: '14px 18px', maxWidth: '90%', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  {m.content ? renderContent(m.content) : (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 20 }}>
                      {[0,1,2].map(j => (
                        <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: '#9ca3af', animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite` }} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 16px', fontSize: 12, color: '#dc2626', marginBottom: 16 }}>
              ⚠ {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div style={{ padding: '12px 24px 16px', borderTop: '1px solid #e5e7eb', background: 'white' }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <AiInput inputRef={inputRef} input={input} setInput={setInput} loading={loading} onSend={() => send(input)} onKey={handleKey} />
          {messages.length > 1 && (
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <button onClick={() => { setMessages([]); setStarted(false); setError('') }}
                style={{ background: 'transparent', border: 'none', fontSize: 11, color: '#9ca3af', cursor: 'pointer', textDecoration: 'underline' }}>
                Start new conversation
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,80%,100%{opacity:.3} 40%{opacity:1} }`}</style>
    </div>
  )
}

function AiInput({ inputRef, input, setInput, loading, onSend, onKey }: {
  inputRef: React.RefObject<HTMLTextAreaElement>
  input: string; setInput: (v: string) => void
  loading: boolean; onSend: () => void
  onKey: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 8px 8px 14px', transition: 'border-color 0.1s' }}
      onFocus={() => {}} >
      <textarea
        ref={inputRef}
        value={input}
        onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
        onKeyDown={onKey}
        placeholder="Ask Pabari AI anything… (Enter to send, Shift+Enter for newline)"
        rows={1}
        style={{ flex: 1, border: 'none', background: 'transparent', resize: 'none', outline: 'none', fontSize: 13, color: '#111827', lineHeight: 1.5, minHeight: 22, maxHeight: 120, overflow: 'auto', fontFamily: 'inherit' }}
      />
      <button onClick={onSend} disabled={!input.trim() || loading}
        style={{ width: 34, height: 34, borderRadius: 8, border: 'none', background: (!input.trim() || loading) ? '#e5e7eb' : '#1a3a2a', color: (!input.trim() || loading) ? '#9ca3af' : 'white', cursor: (!input.trim() || loading) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s', fontSize: 15 }}>
        {loading ? '…' : '↑'}
      </button>
    </div>
  )
}
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

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
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
  const [tab,        setTab]        = useState<Tab>('inbox')
  const [filter,     setFilter]     = useState<Filter>('all')
  const [items,      setItems]      = useState<NotifItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [isMobile,   setIsMobile]   = useState(false)
  const [showWA,     setShowWA]     = useState(false)
  const [waPhone,    setWaPhone]    = useState('')
  const [waSaving,   setWaSaving]   = useState(false)
  const [waMsg,      setWaMsg]      = useState('')
  const [waLogs,     setWaLogs]     = useState<{id:number;to_phone:string;status:string;error_msg:string;created_at:string}[]>([])
  const [waTab,      setWaTab]      = useState<'number'|'log'>('number')
  const [pushStatus, setPushStatus] = useState<'unknown'|'granted'|'denied'|'loading'>('unknown')

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

  const isAdmin = currentUser.role === 'admin'

  // Check push permission on mount and register service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    setPushStatus(Notification.permission === 'granted' ? 'granted' : Notification.permission === 'denied' ? 'denied' : 'unknown')
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  async function enablePushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Push notifications are not supported in this browser.')
      return
    }
    setPushStatus('loading')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setPushStatus('denied'); return }

      // Get VAPID public key from server
      const keyRes = await fetch('/api/push/vapid-key', { credentials: 'include' })
      if (!keyRes.ok) { setPushStatus('unknown'); return }
      const { publicKey } = await keyRes.json()

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      await fetch('/api/push/subscribe', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setPushStatus('granted')
    } catch (e) {
      console.error('Push subscribe error:', e)
      setPushStatus('unknown')
    }
  }

  async function disablePushNotifications() {
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setPushStatus('unknown')
    } catch { setPushStatus('unknown') }
  }

  // Load saved WhatsApp number and delivery log when modal opens
  useEffect(() => {
    if (!showWA) return
    fetch('/api/profile/whatsapp', { credentials: 'include' })
      .then(r => r.json()).then(d => setWaPhone(d.phone ?? '')).catch(() => {})
    if (isAdmin) {
      fetch('/api/admin/whatsapp-log', { credentials: 'include' })
        .then(r => r.json()).then(d => setWaLogs(d.logs ?? [])).catch(() => {})
    }
  }, [showWA, isAdmin])

  async function saveWhatsApp() {
    setWaSaving(true); setWaMsg('')
    try {
      const r = await fetch('/api/profile/whatsapp', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waPhone }),
      })
      const j = await r.json()
      if (!r.ok) { setWaMsg(j.error ?? 'Failed to save'); return }
      setWaMsg('Saved! You will now receive WhatsApp notifications.')
      setTimeout(() => setShowWA(false), 1800)
    } finally { setWaSaving(false) }
  }

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
          <button
            onClick={pushStatus === 'granted' ? disablePushNotifications : enablePushNotifications}
            disabled={pushStatus === 'loading' || pushStatus === 'denied'}
            title={pushStatus === 'granted' ? 'Push notifications ON — click to disable' : pushStatus === 'denied' ? 'Notifications blocked in browser settings' : 'Enable push notifications'}
            style={{ background: pushStatus === 'granted' ? '#1a3a2a' : pushStatus === 'denied' ? '#e5e7eb' : 'white', color: pushStatus === 'granted' ? 'white' : pushStatus === 'denied' ? '#9ca3af' : '#374151', border: `1px solid ${pushStatus === 'granted' ? '#1a3a2a' : '#d1d5db'}`, borderRadius: 6, padding: '5px 10px', fontSize: 16, cursor: pushStatus === 'denied' ? 'not-allowed' : 'pointer', lineHeight: 1 }}>
            {pushStatus === 'loading' ? '…' : '🔔'}
          </button>
          <button onClick={() => setShowWA(true)} title="Set WhatsApp notification number"
            style={{ background: '#25D366', color: 'white', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 16, cursor: 'pointer', lineHeight: 1 }}>
            📱
          </button>
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
                { key: 'ai',    icon: '🤖', label: 'Pabari AI', badge: 0 },
              ] as { key: Tab; icon: string; label: string; badge: number }[]
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
        <div style={{ flex: 1, overflowY: (tab === 'chat' || tab === 'ai') ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>

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
            <AiTab currentUser={currentUser} />
          )}

        </div>
      </div>

      {/* ── WHATSAPP SETUP MODAL ─────────────────────────────────────────────── */}
      {showWA && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 480, position: 'relative' }}>
            {/* Header */}
            <div style={{ padding: '24px 24px 0', borderBottom: '1px solid #f3f4f6', paddingBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>📱</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>WhatsApp Notifications</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Backup alerts when you&#39;re offline</div>
              </div>
              <button onClick={() => setShowWA(false)}
                style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af', padding: 4 }}>✕</button>
            </div>

            {/* Tabs — admin only sees Log tab */}
            {isAdmin && (
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '0 24px' }}>
                {(['number', 'log'] as const).map(t => (
                  <button key={t} onClick={() => setWaTab(t)}
                    style={{ padding: '10px 14px', border: 'none', borderBottom: waTab === t ? '2px solid #25D366' : '2px solid transparent', background: 'transparent', fontSize: 13, fontWeight: waTab === t ? 700 : 400, color: waTab === t ? '#111827' : '#6b7280', cursor: 'pointer' }}>
                    {t === 'number' ? 'My Number' : 'Delivery Log'}
                  </button>
                ))}
              </div>
            )}

            <div style={{ padding: 24 }}>

              {/* ── NUMBER TAB ── */}
              {waTab === 'number' && (<>
                <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 16 }}>
                  You&#39;ll receive WhatsApp alerts for: petty cash approvals, disbursements, leave decisions, and task assignments.
                </div>

                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                  Your WhatsApp Number (with country code)
                </label>
                <input type="tel" value={waPhone} onChange={e => setWaPhone(e.target.value)}
                  placeholder="+254 700 000 000"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
                />

                {waMsg && (
                  <div style={{ fontSize: 12, color: waMsg.startsWith('Saved') ? '#166534' : '#dc2626', marginBottom: 10, padding: '8px 12px', background: waMsg.startsWith('Saved') ? '#f0fdf4' : '#fef2f2', borderRadius: 6 }}>
                    {waMsg}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={saveWhatsApp} disabled={waSaving}
                    style={{ flex: 1, background: '#25D366', color: 'white', border: 'none', borderRadius: 8, padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: waSaving ? 'not-allowed' : 'pointer', opacity: waSaving ? 0.7 : 1 }}>
                    {waSaving ? 'Saving…' : 'Save Number'}
                  </button>
                  {waPhone && (
                    <button onClick={() => { setWaPhone(''); saveWhatsApp() }}
                      style={{ background: 'transparent', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 8, padding: '10px 14px', fontSize: 13, cursor: 'pointer' }}>
                      Remove
                    </button>
                  )}
                </div>

                {/* Webhook setup info for admin */}
                {isAdmin && (
                  <div style={{ marginTop: 20, padding: 14, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Webhook Setup (Meta Dashboard)</div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700 }}>Callback URL:</span>
                    </div>
                    <div style={{ background: '#1e293b', color: '#86efac', padding: '8px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: 10 }}>
                      {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/whatsapp
                    </div>
                    <div style={{ fontSize: 12, color: '#374151', marginBottom: 6 }}>
                      <span style={{ fontWeight: 700 }}>Verify Token:</span> set <code style={{ background: '#f1f5f9', padding: '2px 5px', borderRadius: 3, fontSize: 11 }}>WHATSAPP_WEBHOOK_VERIFY_TOKEN</code> in Railway to any secret string, then paste the same value in Meta.
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280' }}>Subscribe to: <strong>messages</strong> and <strong>message_deliveries</strong></div>
                  </div>
                )}
              </>)}

              {/* ── DELIVERY LOG TAB (admin only) ── */}
              {waTab === 'log' && isAdmin && (
                <div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>Recent WhatsApp delivery statuses (last 200)</div>
                  {waLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>No delivery records yet</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 340, overflowY: 'auto' }}>
                      {waLogs.map(l => {
                        const statusColor: Record<string, string> = { sent: '#2563eb', delivered: '#059669', read: '#7c3aed', failed: '#dc2626' }
                        const col = statusColor[l.status] ?? '#6b7280'
                        return (
                          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#f9fafb', borderRadius: 6, border: `1px solid ${l.status === 'failed' ? '#fecaca' : '#e5e7eb'}` }}>
                            <span style={{ width: 64, fontSize: 11, fontWeight: 700, color: col, textTransform: 'uppercase', flexShrink: 0 }}>{l.status}</span>
                            <span style={{ flex: 1, fontSize: 12, color: '#374151' }}>{l.to_phone}</span>
                            {l.error_msg && <span style={{ fontSize: 11, color: '#dc2626' }} title={l.error_msg}>⚠ {l.error_msg.slice(0, 30)}</span>}
                            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{new Date(l.created_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
