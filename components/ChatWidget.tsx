'use client'

import { useState, useEffect, useRef } from 'react'
import { SessionUser } from '@/types'

// ── Types ────────────────────────────────────────────────────────────────────
interface ChatMsg {
  id: number; user_id: string; user_name: string; message: string
  channel: string; is_system: boolean
  to_user_id?: string; to_user_name?: string; created_at: string
}
interface DmUser { id: string; name: string; department: string; role: string }
type Channel = 'all' | 'hod' | 'finance' | 'system'
type Tab     = Channel | 'direct'

// ── Constants ────────────────────────────────────────────────────────────────
const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const CHANNELS: Channel[] = ['all', 'hod', 'finance', 'system']

// ── Helpers ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#1a3a2a','#2d6a4f','#b5833a','#7b2d8b','#1e40af','#c2410c','#065f46','#92400e','#1d4ed8','#6d28d9']
function avatarColor(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length; return AVATAR_COLORS[h]
}
function initials(name: string): string {
  return name.split(/[\s&./]+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)
}
function fmtTime(iso: string): string {
  return iso ? new Date(iso).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'}) : ''
}
function fmtDateTime(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
}

// ── Message bubble renderer ───────────────────────────────────────────────────
function MsgBubble({ msg, i, list, myId, isDM = false }: { msg: ChatMsg; i: number; list: ChatMsg[]; myId: string; isDM?: boolean }) {
  if (msg.is_system) {
    return (
      <div style={{textAlign:'center',fontSize:11,color:'#6b7280',padding:'4px 0'}}>
        <span style={{background:'#f3f4f6',padding:'3px 10px',borderRadius:10}}>
          {msg.message} · {fmtDateTime(msg.created_at)}
        </span>
      </div>
    )
  }
  const isMe     = msg.user_id === myId
  // In DMs always show sender name; in group chats collapse repeated sender names
  const prevSame = !isDM && i > 0 && !list[i-1].is_system && list[i-1].user_id === msg.user_id
  const showName = !isMe && !prevSame
  return (
    <div style={{display:'flex',flexDirection:isMe?'row-reverse':'row',gap:7,alignItems:'flex-end'}}>
      {!isMe && showName && (
        <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,background:avatarColor(msg.user_name),color:'white',fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
          {initials(msg.user_name)}
        </div>
      )}
      {!isMe && !showName && <div style={{width:28,flexShrink:0}}/>}
      <div style={{maxWidth:'75%'}}>
        {showName && (
          <div style={{fontSize:11,fontWeight:700,color:'#374151',marginBottom:3,marginLeft:2}}>{msg.user_name}</div>
        )}
        <div style={{padding:'7px 11px',borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px',background:isMe?'#1a3a2a':'#f3f4f6',color:isMe?'white':'#111827',fontSize:13,lineHeight:1.5,wordBreak:'break-word'}}>
          {msg.message}
        </div>
        <div style={{fontSize:9,color:'#9ca3af',marginTop:2,textAlign:isMe?'right':'left'}}>{fmtTime(msg.created_at)}</div>
      </div>
    </div>
  )
}

// ── Send button ───────────────────────────────────────────────────────────────
function SendBtn({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} disabled={!active}
      style={{background:active?'#1a3a2a':'#e5e7eb',color:active?'white':'#9ca3af',border:'none',borderRadius:8,width:36,height:36,fontSize:16,cursor:active?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.15s'}}>
      ➤
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { currentUser: SessionUser }

export default function ChatWidget({ currentUser }: Props) {
  // ── Core state ──────────────────────────────────────────────────────────────
  const [open,      setOpen]      = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [msgs,      setMsgs]      = useState<ChatMsg[]>([])
  const [draft,     setDraft]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [chUnread,  setChUnread]  = useState<Partial<Record<Channel,number>>>({})

  // ── DM state ────────────────────────────────────────────────────────────────
  const [dmWith,    setDmWith]    = useState<DmUser | null>(null)
  const [dmMsgs,    setDmMsgs]    = useState<ChatMsg[]>([])
  const [dmDraft,   setDmDraft]   = useState('')
  const [dmSending, setDmSending] = useState(false)
  const [dmUsers,   setDmUsers]   = useState<DmUser[]>([])
  const [dmSearch,  setDmSearch]  = useState('')
  const [dmLoaded,  setDmLoaded]  = useState(false)
  const [dmUnread,  setDmUnread]  = useState(0)
  const [onlineIds,    setOnlineIds]    = useState<Set<string>>(new Set())
  const [dmUnreadFrom, setDmUnreadFrom] = useState<Set<string>>(new Set())
  const [notifPerm,   setNotifPerm]    = useState<NotificationPermission | null>(null)
  const [connState,   setConnState]    = useState<'ok'|'reconnecting'|'lost'>('ok')
  const pollFailsRef = useRef(0)

  // ── Refs (avoids stale closures in intervals) ────────────────────────────────
  const chLastId   = useRef<Partial<Record<Channel,number>>>({})
  const dmLastId   = useRef<Record<string,number>>({})
  const activeTabR = useRef<Tab>('all')
  const openR      = useRef(false)
  const dmWithR    = useRef<DmUser|null>(null)
  const dmUnreadSince = useRef(0)
  const bottomR    = useRef<HTMLDivElement>(null)
  const dmBottomR  = useRef<HTMLDivElement>(null)
  const inputR     = useRef<HTMLTextAreaElement>(null)
  const dmInputR   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { activeTabR.current = activeTab }, [activeTab])
  useEffect(() => { openR.current = open }, [open])
  useEffect(() => { dmWithR.current = dmWith }, [dmWith])

  // ── Access flags ─────────────────────────────────────────────────────────────
  const email      = (currentUser.email ?? '').toLowerCase()
  const isHarshil  = currentUser.role === 'director' && currentUser.department === 'Director'
  const canSeeHOD  = ['admin','director','manager'].includes(currentUser.role)
  const canFinance = ['admin','director','ceo'].includes(currentUser.role) || currentUser.department === 'Finance' || email === FINANCE_EMAIL
  const myId = String(currentUser.id)

  const TABS: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'all',    label: 'All Staff',           visible: true        },
    { id: 'hod',    label: 'HOD',                 visible: canSeeHOD   },
    { id: 'finance',label: 'Finance & Accounts',   visible: canFinance  },
    { id: 'direct', label: '💬 Direct',           visible: true        },
    { id: 'system', label: '🔔 Notifications',    visible: isHarshil   },
  ]
  const visTabs  = TABS.filter(t => t.visible)
  const visChans = visTabs.filter(t => CHANNELS.includes(t.id as Channel)).map(t => t.id as Channel)

  // ── Connection state tracker ─────────────────────────────────────────────────
  function onPollSuccess() {
    if (pollFailsRef.current > 0) { pollFailsRef.current = 0; setConnState('ok') }
  }
  function onPollFailure() {
    pollFailsRef.current += 1
    if (pollFailsRef.current === 2) setConnState('reconnecting')
    if (pollFailsRef.current >= 5) setConnState('lost')
  }

  // ── Fetch channel messages ───────────────────────────────────────────────────
  async function fetchCh(ch: Channel, polling: boolean) {
    try {
      const since = chLastId.current[ch] ?? 0
      const res = await fetch(`/api/chat/messages?channel=${ch}&since=${since}`, { credentials:'include' })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (!res.ok) { if (polling) onPollFailure(); return }
      const { messages: ms } = await res.json() as { messages: ChatMsg[] }
      if (!ms?.length) return
      const isActive = ch === activeTabR.current
      const isOpen   = openR.current
      if (since === 0) {
        chLastId.current[ch] = ms[ms.length-1].id
        if (isActive) setMsgs(ms)
      } else {
        chLastId.current[ch] = ms[ms.length-1].id
        if (isActive) setMsgs(prev => [...prev, ...ms])
        if (polling && (!isOpen || !isActive)) {
          setChUnread(u => ({...u, [ch]: (u[ch]??0) + ms.length}))
          playNotifSound()
        }
      }
      if (polling) onPollSuccess()
    } catch { if (polling) onPollFailure() }
  }

  // ── Fetch DM messages ────────────────────────────────────────────────────────
  async function fetchDM(withUser: DmUser, since: number) {
    try {
      const res = await fetch(`/api/chat/dm?with=${withUser.id}&since=${since}`, { credentials:'include' })
      if (!res.ok) return
      const { messages: ms } = await res.json() as { messages: ChatMsg[] }
      if (!ms?.length) return
      dmLastId.current[withUser.id] = ms[ms.length-1].id
      if (since === 0) { setDmMsgs(ms) } else { setDmMsgs(prev => [...prev, ...ms]) }
      setTimeout(() => dmBottomR.current?.scrollIntoView({ behavior:'smooth' }), 30)
    } catch { /**/ }
  }

  // ── Fetch DM unread count ────────────────────────────────────────────────────
  async function checkDMUnread() {
    try {
      const res = await fetch(`/api/chat/dm/unread?since=${dmUnreadSince.current}`, { credentials:'include' })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (!res.ok) { onPollFailure(); return }
      const { count, maxId, senderIds } = await res.json() as { count: number; maxId: number; senderIds: string[] }
      if (count > 0) {
        const isViewingDMs = openR.current && activeTabR.current === 'direct' && dmWithR.current !== null
        if (!isViewingDMs) {
          setDmUnread(c => c + count)
          playNotifSound()
        }
        if (maxId) dmUnreadSince.current = maxId
        if (senderIds.length) {
          setDmUnreadFrom(prev => {
            const next = new Set(prev)
            senderIds.forEach(id => next.add(id))
            return next
          })
        }
      }
    } catch { /**/ }
  }

  // ── Load DM user list ────────────────────────────────────────────────────────
  async function loadDMUsers() {
    if (dmLoaded) return
    try {
      const res = await fetch('/api/chat/users', { credentials:'include' })
      if (res.ok) {
        const { users } = await res.json() as { users: DmUser[] }
        setDmUsers(users)
        setDmLoaded(true)
      }
    } catch { /**/ }
  }

  // ── Notification sound ───────────────────────────────────────────────────────
  function playNotifSound() {
    try {
      const ctx = new AudioContext()
      const play = (freq: number, start: number, duration: number) => {
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0, ctx.currentTime + start)
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + start)
        osc.stop(ctx.currentTime + start + duration)
      }
      play(880, 0,    0.18)   // first ding
      play(1100, 0.18, 0.22)  // second ding (higher)
      setTimeout(() => ctx.close(), 600)
    } catch { /**/ }
  }

  // ── Presence ping + online fetch ─────────────────────────────────────────────
  async function pingAndRefreshOnline() {
    try {
      const ping = await fetch('/api/chat/ping', { method:'POST', credentials:'include' })
      if (ping.status === 401) { window.location.href = '/login'; return }
      const res = await fetch('/api/chat/online', { credentials:'include' })
      if (res.ok) {
        const { users } = await res.json() as { users: { user_id: string }[] }
        setOnlineIds(new Set(users.map(u => u.user_id)))
        onPollSuccess()
      }
    } catch { onPollFailure() }
  }

  // ── Polling setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    pingAndRefreshOnline()
    visChans.forEach(ch => fetchCh(ch, false))

    const pingT = setInterval(pingAndRefreshOnline, 30000)

    const pollT = setInterval(() => {
      visChans.forEach(ch => fetchCh(ch, true))
      const cur = dmWithR.current
      if (activeTabR.current === 'direct' && cur && (dmLastId.current[cur.id] ?? 0) > 0) {
        fetchDM(cur, dmLastId.current[cur.id])
      }
      checkDMUnread()
    }, 3000)

    return () => { clearInterval(pingT); clearInterval(pollT) }
  }, []) // eslint-disable-line

  // ── Push notification registration ───────────────────────────────────────────
  const VAPID_PUBLIC_KEY = 'BCBZxG0u3uHsKLcfShzJPs_K-9XLAiA1BFj2q0flXWqzgAWhdBZBwv-OFv7slY4GvEoUXdMH-gCksVuUGkPCs-I'

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    try {
      const reg = await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      const sub = existing ?? await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: VAPID_PUBLIC_KEY,
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) console.error('[push] save subscription failed', res.status)
    } catch (err) {
      console.error('[push] subscribe failed:', err)
    }
  }

  async function requestNotifPermission() {
    const perm = await Notification.requestPermission()
    setNotifPerm(perm)
    if (perm === 'granted') await subscribeToPush()
  }

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(err => console.error('[sw]', err))
    setNotifPerm(Notification.permission)
    if (Notification.permission === 'granted') subscribeToPush()
  }, []) // eslint-disable-line

  // ── Load on tab change ────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'direct') {
      loadDMUsers()
    } else {
      setMsgs([])
      fetchCh(activeTab as Channel, false)
    }
  }, [activeTab]) // eslint-disable-line

  // ── Load DM conversation when dmWith changes ──────────────────────────────────
  useEffect(() => {
    if (dmWith) {
      setDmMsgs([])
      fetchDM(dmWith, 0)
      setDmUnread(0)
    }
  }, [dmWith?.id]) // eslint-disable-line

  // ── Scroll to bottom / clear unread ──────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setChUnread(u => ({ ...u, [activeTab]: 0 }))
    if (activeTab === 'direct') {
      if (dmWith) {
        setTimeout(() => dmBottomR.current?.scrollIntoView({ behavior:'smooth' }), 50)
        setTimeout(() => dmInputR.current?.focus(), 80)
      }
    } else {
      setTimeout(() => bottomR.current?.scrollIntoView({ behavior:'smooth' }), 50)
      setTimeout(() => inputR.current?.focus(), 80)
    }
  }, [open, activeTab, msgs.length, dmMsgs.length]) // eslint-disable-line

  // Clear DM unread when Direct tab is open with a conversation
  useEffect(() => {
    if (open && activeTab === 'direct' && dmWith) setDmUnread(0)
  }, [open, activeTab, dmWith])

  // ── Send handlers ─────────────────────────────────────────────────────────────
  async function sendMsg() {
    if (!draft.trim() || sending || activeTab === 'system' || activeTab === 'direct') return
    setSending(true)
    try {
      const res = await fetch('/api/chat/messages', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ message: draft.trim(), channel: activeTab }),
      })
      if (res.ok) {
        const { message: m } = await res.json() as { message: ChatMsg }
        setMsgs(p => [...p, m])
        chLastId.current[activeTab as Channel] = m.id
        setDraft('')
        setTimeout(() => bottomR.current?.scrollIntoView({ behavior:'smooth' }), 30)
      }
    } catch { /**/ } finally { setSending(false) }
  }

  async function sendDM() {
    if (!dmDraft.trim() || dmSending || !dmWith) return
    setDmSending(true)
    try {
      const res = await fetch('/api/chat/dm', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ toUserId: dmWith.id, toUserName: dmWith.name, message: dmDraft.trim() }),
      })
      if (res.ok) {
        const { message: m } = await res.json() as { message: ChatMsg }
        setDmMsgs(p => [...p, m])
        dmLastId.current[dmWith.id] = m.id
        setDmDraft('')
        setTimeout(() => dmBottomR.current?.scrollIntoView({ behavior:'smooth' }), 30)
      }
    } catch { /**/ } finally { setDmSending(false) }
  }

  function openDM(user: DmUser) {
    setDmWith(user)
    setDmSearch('')
    setDmUnreadFrom(prev => { const next = new Set(prev); next.delete(user.id); return next })
  }
  function closeDM() { setDmWith(null) }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const totalUnread    = Object.values(chUnread).reduce((s,n) => s+(n??0), 0) + dmUnread
  const filteredUsers  = dmUsers
    .filter(u =>
      u.name.toLowerCase().includes(dmSearch.toLowerCase()) ||
      u.department.toLowerCase().includes(dmSearch.toLowerCase())
    )
    .sort((a, b) => {
      // unread first, then online, then alphabetical
      const aUnread = dmUnreadFrom.has(a.id) ? 0 : 1
      const bUnread = dmUnreadFrom.has(b.id) ? 0 : 1
      if (aUnread !== bUnread) return aUnread - bUnread
      const aOnline = onlineIds.has(a.id) ? 0 : 1
      const bOnline = onlineIds.has(b.id) ? 0 : 1
      if (aOnline !== bOnline) return aOnline - bOnline
      return a.name.localeCompare(b.name)
    })
  const inDMConvo = activeTab === 'direct' && dmWith !== null

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Toggle button ─────────────────────────────────────────────────── */}
      <style>{`
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.8; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <div
        onClick={() => setOpen(v => !v)}
        title="Organisation Chat"
        style={{position:'fixed',bottom:24,left:24,zIndex:900,width:52,height:52,borderRadius:'50%',background:'#1a3a2a',color:'white',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',boxShadow:'0 4px 16px rgba(0,0,0,0.25)',fontSize:22,userSelect:'none',transition:'transform 0.15s',}}
        onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1.08)'}
        onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.transform='scale(1)'}
      >
        {open ? '✕' : '💬'}
        {!open && totalUnread > 0 && (
          <>
            {/* Pulsing ring */}
            <div style={{position:'absolute',top:-4,right:-4,width:18,height:18,borderRadius:'50%',background:'#dc2626',animation:'pulse-ring 1.4s ease-out infinite'}}/>
            {/* Count badge */}
            <div style={{position:'absolute',top:-4,right:-4,background:'#dc2626',color:'white',borderRadius:'50%',width:18,height:18,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid white'}}>
              {totalUnread > 9 ? '9+' : totalUnread}
            </div>
          </>
        )}
      </div>

      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      {open && (
        <div style={{position:'fixed',bottom:88,left:24,zIndex:900,width:340,maxWidth:'calc(100vw - 48px)',height:500,maxHeight:'calc(100vh - 120px)',background:'white',borderRadius:14,boxShadow:'0 12px 48px rgba(0,0,0,0.18)',display:'flex',flexDirection:'column',overflow:'hidden',border:'1px solid #e5e7eb'}}>

          {/* Header */}
          {inDMConvo ? (
            <div style={{background:'#1a3a2a',color:'white',padding:'10px 14px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
              <button onClick={closeDM} style={{background:'none',border:'none',color:'white',fontSize:20,cursor:'pointer',padding:0,lineHeight:1,opacity:0.85}}>←</button>
              <div style={{width:30,height:30,borderRadius:'50%',background:avatarColor(dmWith!.name),color:'white',fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {initials(dmWith!.name)}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{dmWith!.name}</div>
                <div style={{fontSize:10,display:'flex',alignItems:'center',gap:4}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:onlineIds.has(dmWith!.id)?'#4ade80':'rgba(255,255,255,0.3)',display:'inline-block',flexShrink:0}}/>
                  <span style={{color: onlineIds.has(dmWith!.id) ? '#86efac' : 'rgba(255,255,255,0.45)'}}>{onlineIds.has(dmWith!.id) ? 'Online' : 'Away'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{background:'#1a3a2a',color:'white',padding:'12px 16px',flexShrink:0}}>
              <div style={{fontSize:13,fontWeight:700}}>Organisation Chat</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:1}}>Pabari Group · Internal</div>
            </div>
          )}

          {/* Connection lost banner */}
          {connState !== 'ok' && (
            <div style={{background: connState === 'lost' ? '#fef2f2' : '#fef9c3', borderBottom:`1px solid ${connState==='lost'?'#fecaca':'#fde047'}`, padding:'6px 14px', display:'flex', alignItems:'center', gap:8, flexShrink:0}}>
              <span style={{fontSize:14}}>{connState === 'lost' ? '⚠️' : '🔄'}</span>
              <span style={{fontSize:11, color: connState === 'lost' ? '#dc2626' : '#713f12', flex:1}}>
                {connState === 'lost' ? 'Connection lost — messages may be delayed' : 'Reconnecting…'}
              </span>
            </div>
          )}

          {/* Push notification prompt */}
          {notifPerm === 'default' && (
            <div style={{background:'#fef9c3',borderBottom:'1px solid #fde047',padding:'7px 14px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
              <span style={{fontSize:16}}>🔔</span>
              <span style={{fontSize:11,color:'#713f12',flex:1}}>Enable notifications to get alerts when away</span>
              <button onClick={requestNotifPermission} style={{fontSize:11,fontWeight:700,color:'white',background:'#1a3a2a',border:'none',borderRadius:6,padding:'4px 10px',cursor:'pointer',flexShrink:0}}>
                Enable
              </button>
            </div>
          )}
          {notifPerm === 'granted' && (
            <div style={{background:'#f0fdf4',borderBottom:'1px solid #bbf7d0',padding:'5px 14px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
              <span style={{fontSize:12}}>🔔</span>
              <span style={{fontSize:11,color:'#166534',flex:1}}>Notifications active</span>
              <button
                onClick={() => fetch('/api/push/test',{method:'POST',credentials:'include'}).then(r=>r.json()).then(d=>d.error && alert(d.error)).catch(()=>{})}
                style={{fontSize:10,color:'#166534',background:'none',border:'1px solid #86efac',borderRadius:6,padding:'3px 8px',cursor:'pointer',flexShrink:0}}
              >
                Test
              </button>
            </div>
          )}

          {/* Tab bar — hidden inside a DM conversation */}
          {!inDMConvo && (
            <div style={{display:'flex',borderBottom:'1px solid #e5e7eb',background:'#f9fafb',overflowX:'auto',flexShrink:0}}>
              {visTabs.map(t => {
                const u = t.id === 'direct' ? dmUnread : (chUnread[t.id as Channel] ?? 0)
                const isActive = activeTab === t.id
                return (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} style={{flex:'0 0 auto',padding:'8px 11px',border:'none',background:'transparent',cursor:'pointer',fontSize:11,fontWeight:isActive?700:400,color:isActive?'#1a3a2a':'#6b7280',borderBottom:isActive?'2px solid #1a3a2a':'2px solid transparent',whiteSpace:'nowrap',position:'relative'}}>
                    {t.label}
                    {u > 0 && !isActive && (
                      <span style={{marginLeft:4,background:'#dc2626',color:'white',borderRadius:8,fontSize:9,fontWeight:700,padding:'1px 5px',verticalAlign:'middle'}}>{u}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* ── Content ─────────────────────────────────────────────────── */}

          {/* Regular channel messages */}
          {activeTab !== 'direct' && (
            <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
              {msgs.length === 0 && (
                <div style={{textAlign:'center',color:'#9ca3af',fontSize:12,marginTop:40}}>
                  {activeTab === 'system' ? 'Login and logout events will appear here.' : 'No messages yet. Say hello!'}
                </div>
              )}
              {msgs.map((msg, i) => <MsgBubble key={msg.id} msg={msg} i={i} list={msgs} myId={myId} />)}
              <div ref={bottomR}/>
            </div>
          )}

          {/* DM conversation */}
          {inDMConvo && (
            <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
              {dmMsgs.length === 0 && (
                <div style={{textAlign:'center',color:'#9ca3af',fontSize:12,marginTop:40}}>
                  Start a private conversation with {dmWith!.name}
                </div>
              )}
              {dmMsgs.map((msg, i) => <MsgBubble key={msg.id} msg={msg} i={i} list={dmMsgs} myId={myId} isDM={true} />)}
              <div ref={dmBottomR}/>
            </div>
          )}

          {/* DM user list */}
          {activeTab === 'direct' && !dmWith && (
            <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{padding:'10px 14px',borderBottom:'1px solid #f0f0f0',flexShrink:0}}>
                <input
                  value={dmSearch} onChange={e => setDmSearch(e.target.value)}
                  placeholder="Search people…"
                  style={{width:'100%',border:'1px solid #e5e7eb',borderRadius:8,padding:'7px 11px',fontSize:12,outline:'none',boxSizing:'border-box' as const,fontFamily:'inherit'}}
                />
              </div>
              <div style={{flex:1,overflowY:'auto'}}>
                {filteredUsers.length === 0 && (
                  <div style={{textAlign:'center',color:'#9ca3af',fontSize:12,padding:24}}>
                    {dmLoaded ? 'No users found' : 'Loading…'}
                  </div>
                )}
                {filteredUsers.map(u => {
                  const isOnline  = onlineIds.has(u.id)
                  const hasUnread = dmUnreadFrom.has(u.id)
                  return (
                    <div key={u.id}
                      onClick={() => openDM(u)}
                      style={{display:'flex',alignItems:'center',gap:11,padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #f9fafb',background: hasUnread ? '#fef2f2' : ''}}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background= hasUnread ? '#fee2e2' : '#f9fafb'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background= hasUnread ? '#fef2f2' : ''}
                    >
                      <div style={{position:'relative',flexShrink:0}}>
                        <div style={{width:36,height:36,borderRadius:'50%',background:avatarColor(u.name),color:'white',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
                          {initials(u.name)}
                        </div>
                        <span style={{position:'absolute',bottom:0,right:0,width:10,height:10,borderRadius:'50%',background:isOnline?'#22c55e':'#d1d5db',border:'2px solid white',display:'block'}}/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight: hasUnread ? 700 : 600,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.name}</div>
                        <div style={{fontSize:11,color: hasUnread ? '#dc2626' : isOnline ? '#16a34a' : '#9ca3af',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {hasUnread ? 'New message' : isOnline ? 'Online' : u.department}
                        </div>
                      </div>
                      {hasUnread && (
                        <span style={{background:'#dc2626',color:'white',borderRadius:'50%',width:18,height:18,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>!</span>
                      )}
                      {!hasUnread && <div style={{color:'#d1d5db',fontSize:18,fontWeight:300}}>›</div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Input area ─────────────────────────────────────────────── */}

          {/* Channel input */}
          {activeTab !== 'system' && activeTab !== 'direct' && (
            <div style={{borderTop:'1px solid #f0f0f0',padding:'10px 12px',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
              <textarea
                ref={inputR} value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMsg()} }}
                placeholder={`Message ${visTabs.find(t=>t.id===activeTab)?.label??''}… (Enter to send)`}
                rows={1}
                style={{flex:1,border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 11px',fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',lineHeight:1.4,maxHeight:80,overflowY:'auto'}}
              />
              <SendBtn onClick={sendMsg} active={!!draft.trim() && !sending} />
            </div>
          )}

          {/* DM input */}
          {inDMConvo && (
            <div style={{borderTop:'1px solid #f0f0f0',padding:'10px 12px',display:'flex',gap:8,alignItems:'flex-end',flexShrink:0}}>
              <textarea
                ref={dmInputR} value={dmDraft}
                onChange={e => setDmDraft(e.target.value)}
                onKeyDown={e => { if (e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendDM()} }}
                placeholder={`Message ${dmWith!.name}… (Enter to send)`}
                rows={1}
                style={{flex:1,border:'1px solid #e5e7eb',borderRadius:8,padding:'8px 11px',fontSize:13,resize:'none',outline:'none',fontFamily:'inherit',lineHeight:1.4,maxHeight:80,overflowY:'auto'}}
              />
              <SendBtn onClick={sendDM} active={!!dmDraft.trim() && !dmSending} />
            </div>
          )}
        </div>
      )}
    </>
  )
}
