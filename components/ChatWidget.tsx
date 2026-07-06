'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SessionUser } from '@/types'

interface ChatMessage {
  id:         number
  user_id:    string
  user_name:  string
  message:    string
  channel:    string
  is_system:  boolean
  created_at: string
}

type Channel = 'all' | 'hod' | 'finance' | 'system'

const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const HARSHIL_EMAIL = 'hkotecha@kwale-group.com'

const AVATAR_COLORS = [
  '#1a3a2a','#2d6a4f','#b5833a','#7b2d8b','#1e40af',
  '#c2410c','#065f46','#92400e','#1d4ed8','#6d28d9',
]
function avatarColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length
  return AVATAR_COLORS[h]
}
function initials(name: string): string {
  return name.split(/[\s&./]+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)
}
function fmtTime(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}
function fmtDateTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

interface Props { currentUser: SessionUser }

export default function ChatWidget({ currentUser }: Props) {
  const [open,     setOpen]     = useState(false)
  const [channel,  setChannel]  = useState<Channel>('all')
  const [msgs,     setMsgs]     = useState<ChatMessage[]>([])
  const [draft,    setDraft]    = useState('')
  const [sending,  setSending]  = useState(false)
  const [unread,   setUnread]   = useState<Partial<Record<Channel,number>>>({})

  const lastIdRef = useRef<Partial<Record<Channel,number>>>({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const isHarshil    = (currentUser.email ?? '').toLowerCase() === HARSHIL_EMAIL
  const canSeeHOD    = currentUser.role !== 'staff'
  const canSeeFinance = ['admin','director','ceo'].includes(currentUser.role)
    || currentUser.department === 'Finance'
    || (currentUser.email ?? '').toLowerCase() === FINANCE_EMAIL

  const channels: { id: Channel; label: string; visible: boolean }[] = [
    { id: 'all',     label: 'Open to All',       visible: true },
    { id: 'hod',     label: 'HOD',               visible: canSeeHOD },
    { id: 'finance', label: 'Finance & Accounts', visible: canSeeFinance },
    { id: 'system',  label: '🔔 Notifications',  visible: isHarshil },
  ]
  const visibleChannels = channels.filter(c => c.visible)

  // ── Fetch messages for a given channel ───────────────────────────────────
  const fetchChannel = useCallback(async (ch: Channel, isPolling = false) => {
    try {
      const since = lastIdRef.current[ch] ?? 0
      const res = await fetch(`/api/chat/messages?channel=${ch}&since=${since}`, { credentials:'include' })
      if (!res.ok) return
      const { messages: newMsgs } = await res.json() as { messages: ChatMessage[] }
      if (!newMsgs?.length) return

      if (since === 0) {
        // Initial load
        setMsgs(prev => ch === channel ? newMsgs : prev)
        lastIdRef.current[ch] = newMsgs[newMsgs.length - 1].id
      } else {
        // Polling — new messages arrived
        lastIdRef.current[ch] = newMsgs[newMsgs.length - 1].id
        if (ch === channel) {
          setMsgs(prev => [...prev, ...newMsgs])
        }
        if (isPolling && (!open || ch !== channel)) {
          setUnread(u => ({ ...u, [ch]: (u[ch] ?? 0) + newMsgs.length }))
        }
      }
    } catch { /* ignore */ }
  }, [channel, open])

  // ── Ping presence ─────────────────────────────────────────────────────────
  const ping = useCallback(() => {
    fetch('/api/chat/ping', { method:'POST', credentials:'include' }).catch(() => {})
  }, [])

  // ── Initial load when channel changes ────────────────────────────────────
  useEffect(() => {
    // Reset messages and load for new channel
    setMsgs([])
    fetchChannel(channel, false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel])

  // ── Polling: all visible channels every 3s ────────────────────────────────
  useEffect(() => {
    ping()
    const pingTimer = setInterval(ping, 30000)

    // Load initial messages for all visible channels (to track unread)
    visibleChannels.forEach(c => {
      if (c.id !== channel) fetchChannel(c.id, false)
    })

    const pollTimer = setInterval(() => {
      visibleChannels.forEach(c => fetchChannel(c.id, true))
    }, 3000)

    return () => { clearInterval(pingTimer); clearInterval(pollTimer) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Scroll to bottom & clear unread when opened/channel changes ──────────
  useEffect(() => {
    if (open) {
      setUnread(u => ({ ...u, [channel]: 0 }))
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 50)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, channel, msgs.length])

  // ── Send ──────────────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!draft.trim() || sending || channel === 'system') return
    setSending(true)
    try {
      const res = await fetch('/api/chat/messages', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: draft.trim(), channel }),
      })
      if (res.ok) {
        const { message } = await res.json() as { message: ChatMessage }
        setMsgs(prev => [...prev, message])
        lastIdRef.current[channel] = message.id
        setDraft('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 30)
      }
    } catch { /* ignore */ }
    finally  { setSending(false) }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const totalUnread = Object.values(unread).reduce((s, n) => s + (n ?? 0), 0)
  const myId = String(currentUser.id)

  return (
    <>
      {/* ── Toggle button ── */}
      <div
        onClick={() => setOpen(v => !v)}
        title="Organisation Chat"
        style={{
          position:'fixed', bottom:24, left:24, zIndex:900,
          width:52, height:52, borderRadius:'50%',
          background:'#1a3a2a', color:'white',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'0 4px 16px rgba(0,0,0,0.25)',
          fontSize:22, userSelect:'none', transition:'transform 0.15s',
        }}
        onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1.08)'}
        onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1)'}
      >
        {open ? '✕' : '💬'}
        {!open && totalUnread > 0 && (
          <div style={{
            position:'absolute', top:-4, right:-4,
            background:'#dc2626', color:'white', borderRadius:'50%',
            width:18, height:18, fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid white',
          }}>{totalUnread > 9 ? '9+' : totalUnread}</div>
        )}
      </div>

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position:'fixed', bottom:88, left:24, zIndex:900,
          width:340, maxWidth:'calc(100vw - 48px)',
          height:500, maxHeight:'calc(100vh - 120px)',
          background:'white', borderRadius:14,
          boxShadow:'0 12px 48px rgba(0,0,0,0.18)',
          display:'flex', flexDirection:'column',
          overflow:'hidden', border:'1px solid #e5e7eb',
        }}>

          {/* Header */}
          <div style={{background:'#1a3a2a',color:'white',padding:'12px 16px',flexShrink:0}}>
            <div style={{fontSize:13,fontWeight:700}}>Organisation Chat</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:1}}>Pabari Group · Internal</div>
          </div>

          {/* Channel tabs */}
          <div style={{
            display:'flex', borderBottom:'1px solid #e5e7eb',
            background:'#f9fafb', overflowX:'auto', flexShrink:0,
          }}>
            {visibleChannels.map(c => {
              const u = unread[c.id] ?? 0
              const isActive = channel === c.id
              return (
                <button key={c.id}
                  onClick={() => setChannel(c.id)}
                  style={{
                    flex:'0 0 auto', padding:'8px 12px', border:'none',
                    background:'transparent', cursor:'pointer', fontSize:11,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#1a3a2a' : '#6b7280',
                    borderBottom: isActive ? '2px solid #1a3a2a' : '2px solid transparent',
                    position:'relative', whiteSpace:'nowrap',
                  }}>
                  {c.label}
                  {u > 0 && !isActive && (
                    <span style={{
                      marginLeft:4, background:'#dc2626', color:'white',
                      borderRadius:8, fontSize:9, fontWeight:700,
                      padding:'1px 5px', verticalAlign:'middle',
                    }}>{u}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Messages */}
          <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
            {msgs.length === 0 && (
              <div style={{textAlign:'center',color:'#9ca3af',fontSize:12,marginTop:40}}>
                {channel === 'system' ? 'Login and logout events will appear here.' : 'No messages yet. Say hello!'}
              </div>
            )}
            {msgs.map((msg, i) => {
              if (msg.is_system) {
                return (
                  <div key={msg.id} style={{textAlign:'center',fontSize:11,color:'#6b7280',padding:'4px 0'}}>
                    <span style={{background:'#f3f4f6',padding:'3px 10px',borderRadius:10}}>
                      {msg.message} · {fmtDateTime(msg.created_at)}
                    </span>
                  </div>
                )
              }
              const isMe = msg.user_id === myId
              const prevSame = i > 0 && !msgs[i-1].is_system && msgs[i-1].user_id === msg.user_id
              return (
                <div key={msg.id} style={{display:'flex',flexDirection: isMe ? 'row-reverse' : 'row',gap:7,alignItems:'flex-end'}}>
                  {!isMe && !prevSame && (
                    <div style={{
                      width:28,height:28,borderRadius:'50%',flexShrink:0,
                      background:avatarColor(msg.user_name),color:'white',
                      fontSize:10,fontWeight:700,
                      display:'flex',alignItems:'center',justifyContent:'center',
                    }}>{initials(msg.user_name)}</div>
                  )}
                  {!isMe && prevSame && <div style={{width:28,flexShrink:0}}/>}
                  <div style={{maxWidth:'75%'}}>
                    {!isMe && !prevSame && (
                      <div style={{fontSize:10,fontWeight:600,color:'#6b7280',marginBottom:2,marginLeft:2}}>{msg.user_name}</div>
                    )}
                    <div style={{
                      padding:'7px 11px',
                      borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: isMe ? '#1a3a2a' : '#f3f4f6',
                      color: isMe ? 'white' : '#111827',
                      fontSize:13,lineHeight:1.5,wordBreak:'break-word',
                    }}>{msg.message}</div>
                    <div style={{fontSize:9,color:'#9ca3af',marginTop:2,textAlign: isMe ? 'right' : 'left'}}>
                      {fmtTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={bottomRef}/>
          </div>

          {/* Input — hidden on Notifications tab */}
          {channel !== 'system' && (
            <div style={{borderTop:'1px solid #f0f0f0',padding:'10px 12px',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
              <textarea
                ref={inputRef}
                value={draft}
                onChange={e=>setDraft(e.target.value)}
                onKeyDown={handleKey}
                placeholder={`Message ${visibleChannels.find(c=>c.id===channel)?.label ?? ''}… (Enter to send)`}
                rows={1}
                style={{
                  flex:1,border:'1px solid #e5e7eb',borderRadius:8,
                  padding:'8px 11px',fontSize:13,resize:'none',
                  outline:'none',fontFamily:'inherit',lineHeight:1.4,
                  maxHeight:80,overflowY:'auto',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!draft.trim() || sending}
                style={{
                  background: draft.trim() && !sending ? '#1a3a2a' : '#e5e7eb',
                  color: draft.trim() && !sending ? 'white' : '#9ca3af',
                  border:'none',borderRadius:8,width:36,height:36,
                  fontSize:16,cursor: draft.trim() ? 'pointer' : 'default',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  flexShrink:0,transition:'background 0.15s',
                }}
              >➤</button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
