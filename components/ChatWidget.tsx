'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { SessionUser } from '@/types'

interface ChatMessage {
  id:         number
  user_id:    string
  user_name:  string
  message:    string
  created_at: string
}

interface OnlineUser {
  id:        string
  name:      string
  role:      string
  last_seen: string
}

const HARSHIL_EMAIL = 'harshil@usc.co.ke'

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
  const d = new Date(iso)
  return d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

interface Props {
  currentUser: SessionUser
}

export default function ChatWidget({ currentUser }: Props) {
  const [open,         setOpen]         = useState(false)
  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [draft,        setDraft]        = useState('')
  const [sending,      setSending]      = useState(false)
  const [onlineUsers,  setOnlineUsers]  = useState<OnlineUser[]>([])
  const [showOnline,   setShowOnline]   = useState(false)
  const [unread,       setUnread]       = useState(0)

  const lastIdRef    = useRef(0)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const inputRef     = useRef<HTMLTextAreaElement>(null)
  const isHarshil    = (currentUser.email ?? '').toLowerCase() === HARSHIL_EMAIL

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async (initial = false) => {
    try {
      const since = initial ? 0 : lastIdRef.current
      const res = await fetch(`/api/chat/messages?since=${since}`, { credentials:'include' })
      if (!res.ok) return
      const { messages: newMsgs } = await res.json() as { messages: ChatMessage[] }
      if (!newMsgs?.length) return
      if (initial) {
        setMessages(newMsgs)
        lastIdRef.current = newMsgs[newMsgs.length - 1].id
      } else {
        setMessages(prev => {
          const combined = [...prev, ...newMsgs]
          lastIdRef.current = newMsgs[newMsgs.length - 1].id
          return combined
        })
        if (!open) setUnread(u => u + newMsgs.length)
      }
    } catch { /* ignore network errors */ }
  }, [open])

  // ── Fetch online users (Harshil only) ────────────────────────────────────
  const fetchOnline = useCallback(async () => {
    if (!isHarshil) return
    try {
      const res = await fetch('/api/chat/online', { credentials:'include' })
      if (res.ok) {
        const { users } = await res.json() as { users: OnlineUser[] }
        setOnlineUsers(users ?? [])
      }
    } catch { /* ignore */ }
  }, [isHarshil])

  // ── Ping presence ─────────────────────────────────────────────────────────
  const ping = useCallback(() => {
    fetch('/api/chat/ping', { method:'POST', credentials:'include' }).catch(() => {})
  }, [])

  // ── Mount: load messages, start ping + polling ────────────────────────────
  useEffect(() => {
    fetchMessages(true)
    ping()

    const msgTimer    = setInterval(() => fetchMessages(false), 3000)
    const pingTimer   = setInterval(ping, 30000)
    const onlineTimer = isHarshil ? setInterval(fetchOnline, 10000) : null
    if (isHarshil) fetchOnline()

    return () => {
      clearInterval(msgTimer)
      clearInterval(pingTimer)
      if (onlineTimer) clearInterval(onlineTimer)
    }
  }, [fetchMessages, fetchOnline, ping, isHarshil])

  // ── Scroll to bottom when opened or new messages ─────────────────────────
  useEffect(() => {
    if (open) {
      setUnread(0)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 50)
      setTimeout(() => inputRef.current?.focus(), 80)
    }
  }, [open, messages.length])

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage() {
    if (!draft.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/chat/messages', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: draft.trim() }),
      })
      if (res.ok) {
        const { message } = await res.json() as { message: ChatMessage }
        setMessages(prev => [...prev, message])
        lastIdRef.current = message.id
        setDraft('')
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 30)
      }
    } catch { /* ignore */ }
    finally  { setSending(false) }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const myId = String(currentUser.id)

  return (
    <>
      {/* ── Floating toggle button ── */}
      <div
        onClick={() => setOpen(v => !v)}
        title="Organisation Chat"
        style={{
          position:'fixed', bottom:24, left:24, zIndex:900,
          width:52, height:52, borderRadius:'50%',
          background:'#1a3a2a', color:'white',
          display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', boxShadow:'0 4px 16px rgba(0,0,0,0.25)',
          fontSize:22, userSelect:'none',
          transition:'transform 0.15s',
        }}
        onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1.08)'}
        onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1)'}
      >
        {open ? '✕' : '💬'}
        {!open && unread > 0 && (
          <div style={{
            position:'absolute', top:-4, right:-4,
            background:'#dc2626', color:'white',
            borderRadius:'50%', width:18, height:18,
            fontSize:10, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid white',
          }}>{unread > 9 ? '9+' : unread}</div>
        )}
      </div>

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position:'fixed', bottom:88, left:24, zIndex:900,
          width: isHarshil && showOnline ? 560 : 340,
          maxWidth:'calc(100vw - 48px)',
          height:480, maxHeight:'calc(100vh - 120px)',
          background:'white', borderRadius:14,
          boxShadow:'0 12px 48px rgba(0,0,0,0.18)',
          display:'flex', flexDirection:'column',
          overflow:'hidden',
          border:'1px solid #e5e7eb',
          transition:'width 0.2s',
        }}>

          {/* Panel header */}
          <div style={{
            background:'#1a3a2a', color:'white',
            padding:'12px 16px', display:'flex', alignItems:'center', gap:10, flexShrink:0,
          }}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700}}>Organisation Chat</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',marginTop:1}}>Pabari Group · All staff</div>
            </div>
            {isHarshil && (
              <button
                onClick={()=>setShowOnline(v=>!v)}
                title="Online staff"
                style={{
                  background: showOnline ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                  border:'1px solid rgba(255,255,255,0.2)',
                  color:'white', borderRadius:5, padding:'4px 9px', fontSize:11,
                  cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                }}
              >
                <span style={{width:7,height:7,borderRadius:'50%',background:'#4ade80',display:'inline-block'}}/>
                {onlineUsers.length} online
              </button>
            )}
          </div>

          {/* Body: messages + optional online panel */}
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>

            {/* Message list */}
            <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:10}}>
              {messages.length === 0 && (
                <div style={{textAlign:'center',color:'#9ca3af',fontSize:12,marginTop:40}}>
                  No messages yet. Say hello!
                </div>
              )}
              {messages.map((msg, i) => {
                const isMe = msg.user_id === myId
                const prevSame = i > 0 && messages[i-1].user_id === msg.user_id
                return (
                  <div key={msg.id} style={{display:'flex',flexDirection: isMe ? 'row-reverse' : 'row',gap:7,alignItems:'flex-end'}}>
                    {!isMe && !prevSame && (
                      <div style={{
                        width:28, height:28, borderRadius:'50%', flexShrink:0,
                        background:avatarColor(msg.user_name), color:'white',
                        fontSize:10, fontWeight:700,
                        display:'flex', alignItems:'center', justifyContent:'center',
                      }}>{initials(msg.user_name)}</div>
                    )}
                    {!isMe && prevSame && <div style={{width:28,flexShrink:0}}/>}
                    <div style={{maxWidth:'75%'}}>
                      {!isMe && !prevSame && (
                        <div style={{fontSize:10,fontWeight:600,color:'#6b7280',marginBottom:2,marginLeft:2}}>{msg.user_name}</div>
                      )}
                      <div style={{
                        padding:'7px 11px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                        background: isMe ? '#1a3a2a' : '#f3f4f6',
                        color: isMe ? 'white' : '#111827',
                        fontSize:13, lineHeight:1.5, wordBreak:'break-word',
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

            {/* Online users panel (Harshil only) */}
            {isHarshil && showOnline && (
              <div style={{
                width:190, flexShrink:0, borderLeft:'1px solid #f0f0f0',
                overflowY:'auto', padding:'10px 12px',
              }}>
                <div style={{fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:10}}>
                  Online Now · {onlineUsers.length}
                </div>
                {onlineUsers.length === 0 && (
                  <div style={{fontSize:11,color:'#9ca3af'}}>No one online yet</div>
                )}
                {onlineUsers.map(u => (
                  <div key={u.id} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <div style={{position:'relative'}}>
                      <div style={{
                        width:28,height:28,borderRadius:'50%',
                        background:avatarColor(u.name),color:'white',
                        fontSize:10,fontWeight:700,
                        display:'flex',alignItems:'center',justifyContent:'center',
                        flexShrink:0,
                      }}>{initials(u.name)}</div>
                      <div style={{
                        position:'absolute',bottom:0,right:0,
                        width:8,height:8,borderRadius:'50%',
                        background:'#4ade80',border:'1.5px solid white',
                      }}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,fontWeight:600,color:'#111827',lineHeight:1.2}}>{u.name}</div>
                      <div style={{fontSize:9,color:'#9ca3af',textTransform:'capitalize'}}>{u.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{borderTop:'1px solid #f0f0f0',padding:'10px 12px',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
            <textarea
              ref={inputRef}
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Message everyone… (Enter to send)"
              rows={1}
              style={{
                flex:1, border:'1px solid #e5e7eb', borderRadius:8,
                padding:'8px 11px', fontSize:13, resize:'none',
                outline:'none', fontFamily:'inherit', lineHeight:1.4,
                maxHeight:80, overflowY:'auto',
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!draft.trim() || sending}
              style={{
                background: draft.trim() && !sending ? '#1a3a2a' : '#e5e7eb',
                color: draft.trim() && !sending ? 'white' : '#9ca3af',
                border:'none', borderRadius:8, width:36, height:36,
                fontSize:16, cursor: draft.trim() ? 'pointer' : 'default',
                display:'flex', alignItems:'center', justifyContent:'center',
                flexShrink:0, transition:'background 0.15s',
              }}
            >➤</button>
          </div>
        </div>
      )}
    </>
  )
}
