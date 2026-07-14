'use client'

import { useState, useEffect, useRef } from 'react'
import { SessionUser } from '@/types'

interface ChatMsg {
  id: number; user_id: string; user_name: string; message: string
  channel: string; is_system: boolean
  to_user_id?: string; to_user_name?: string; created_at: string
}
interface DmUser { id: string; name: string; department: string; role: string }
type Channel = 'all' | 'hod' | 'finance'
type Tab     = Channel | 'direct'

const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const CHANNELS: Channel[] = ['all', 'hod', 'finance']
const AVATAR_COLORS = ['#1a3a2a','#2d6a4f','#b5833a','#7b2d8b','#1e40af','#c2410c','#065f46','#92400e','#1d4ed8','#6d28d9']

function avatarColor(name: string) {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length; return AVATAR_COLORS[h]
}
function initials(name: string) {
  return name.split(/[\s&./]+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}
function fmtTime(iso: string) {
  return iso ? new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
}
function fmtDateTime(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function MsgBubble({ msg, i, list, myId, isDM = false }: { msg: ChatMsg; i: number; list: ChatMsg[]; myId: string; isDM?: boolean }) {
  if (msg.is_system) {
    return (
      <div style={{ textAlign: 'center', fontSize: 11, color: '#6b7280', padding: '4px 0' }}>
        <span style={{ background: '#f3f4f6', padding: '3px 10px', borderRadius: 10 }}>
          {msg.message} · {fmtDateTime(msg.created_at)}
        </span>
      </div>
    )
  }
  const isMe     = msg.user_id === myId
  const prevSame = !isDM && i > 0 && !list[i - 1].is_system && list[i - 1].user_id === msg.user_id
  const showName = !isMe && !prevSame
  return (
    <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 7, alignItems: 'flex-end' }}>
      {!isMe && showName && (
        <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: avatarColor(msg.user_name), color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {initials(msg.user_name)}
        </div>
      )}
      {!isMe && !showName && <div style={{ width: 28, flexShrink: 0 }} />}
      <div style={{ maxWidth: '72%' }}>
        {showName && <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 3, marginLeft: 2 }}>{msg.user_name}</div>}
        <div style={{ padding: '8px 12px', borderRadius: isMe ? '14px 14px 2px 14px' : '14px 14px 14px 2px', background: isMe ? '#1a3a2a' : '#f3f4f6', color: isMe ? 'white' : '#111827', fontSize: 13, lineHeight: 1.5, wordBreak: 'break-word' }}>
          {msg.message}
        </div>
        <div style={{ fontSize: 9, color: '#9ca3af', marginTop: 2, textAlign: isMe ? 'right' : 'left' }}>{fmtTime(msg.created_at)}</div>
      </div>
    </div>
  )
}

function SendBtn({ onClick, active }: { onClick: () => void; active: boolean }) {
  return (
    <button onClick={onClick} disabled={!active}
      style={{ background: active ? '#1a3a2a' : '#e5e7eb', color: active ? 'white' : '#9ca3af', border: 'none', borderRadius: 8, width: 36, height: 36, fontSize: 16, cursor: active ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
      ➤
    </button>
  )
}

export default function ChatPanel({ currentUser }: { currentUser: SessionUser }) {
  const [activeTab, setActiveTab] = useState<Tab>('all')
  const [msgs,      setMsgs]      = useState<ChatMsg[]>([])
  const [draft,     setDraft]     = useState('')
  const [sending,   setSending]   = useState(false)
  const [chUnread,  setChUnread]  = useState<Partial<Record<Channel, number>>>({})

  const [dmWith,    setDmWith]    = useState<DmUser | null>(null)
  const [dmMsgs,    setDmMsgs]    = useState<ChatMsg[]>([])
  const [dmDraft,   setDmDraft]   = useState('')
  const [dmSending, setDmSending] = useState(false)
  const [dmUsers,   setDmUsers]   = useState<DmUser[]>([])
  const [dmSearch,  setDmSearch]  = useState('')
  const [dmLoaded,  setDmLoaded]  = useState(false)
  const [dmUnread,  setDmUnread]  = useState(0)
  const [onlineIds,     setOnlineIds]     = useState<Set<string>>(new Set())
  const [dmUnreadFrom,  setDmUnreadFrom]  = useState<Set<string>>(new Set())
  const [connState,     setConnState]     = useState<'ok' | 'reconnecting' | 'lost'>('ok')
  const pollFailsRef = useRef(0)

  const chLastId      = useRef<Partial<Record<Channel, number>>>({})
  const dmLastId      = useRef<Record<string, number>>({})
  const activeTabR    = useRef<Tab>('all')
  const dmWithR       = useRef<DmUser | null>(null)
  const dmUnreadSince = useRef(
    typeof window !== 'undefined'
      ? parseInt(localStorage.getItem(`dm-since-${currentUser.id}`) ?? '0', 10) || 0
      : 0
  )
  const bottomR   = useRef<HTMLDivElement>(null)
  const dmBottomR = useRef<HTMLDivElement>(null)
  const inputR    = useRef<HTMLTextAreaElement>(null)
  const dmInputR  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { activeTabR.current = activeTab }, [activeTab])
  useEffect(() => { dmWithR.current = dmWith }, [dmWith])

  const email      = (currentUser.email ?? '').toLowerCase()
  const canSeeHOD  = ['admin', 'director', 'manager'].includes(currentUser.role)
  const canFinance = ['admin', 'director', 'ceo'].includes(currentUser.role) || currentUser.department === 'Finance' || email === FINANCE_EMAIL
  const myId = String(currentUser.id)

  const TABS: { id: Tab; label: string; visible: boolean }[] = [
    { id: 'all',     label: 'All Staff',          visible: true       },
    { id: 'hod',     label: 'HOD',                visible: canSeeHOD  },
    { id: 'finance', label: 'Finance & Accounts', visible: canFinance },
    { id: 'direct',  label: '💬 Direct',          visible: true       },
  ]
  const visTabs  = TABS.filter(t => t.visible)
  const visChans = visTabs.filter(t => CHANNELS.includes(t.id as Channel)).map(t => t.id as Channel)

  function onPollSuccess() { if (pollFailsRef.current > 0) { pollFailsRef.current = 0; setConnState('ok') } }
  function onPollFailure() {
    pollFailsRef.current += 1
    if (pollFailsRef.current === 2) setConnState('reconnecting')
    if (pollFailsRef.current >= 5) setConnState('lost')
  }

  async function fetchCh(ch: Channel, polling: boolean) {
    try {
      const since = chLastId.current[ch] ?? 0
      const res = await fetch(`/api/chat/messages?channel=${ch}&since=${since}`, { credentials: 'include' })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (!res.ok) { if (polling) onPollFailure(); return }
      const { messages: ms } = await res.json() as { messages: ChatMsg[] }
      if (!ms?.length) return
      const isActive = ch === activeTabR.current
      if (since === 0) {
        chLastId.current[ch] = ms[ms.length - 1].id
        if (isActive) setMsgs(ms)
      } else {
        chLastId.current[ch] = ms[ms.length - 1].id
        if (isActive) setMsgs(prev => [...prev, ...ms])
        if (polling && !isActive) setChUnread(u => ({ ...u, [ch]: (u[ch] ?? 0) + ms.length }))
      }
      if (polling) onPollSuccess()
    } catch { if (polling) onPollFailure() }
  }

  async function fetchDM(withUser: DmUser, since: number) {
    try {
      const res = await fetch(`/api/chat/dm?with=${withUser.id}&since=${since}`, { credentials: 'include' })
      if (!res.ok) return
      const { messages: ms } = await res.json() as { messages: ChatMsg[] }
      if (!ms?.length) return
      const lastId = ms[ms.length - 1].id
      dmLastId.current[withUser.id] = lastId
      if (lastId > dmUnreadSince.current) {
        dmUnreadSince.current = lastId
        localStorage.setItem(`dm-since-${currentUser.id}`, String(lastId))
      }
      if (since === 0) { setDmMsgs(ms) } else { setDmMsgs(prev => [...prev, ...ms]) }
      setTimeout(() => dmBottomR.current?.scrollIntoView({ behavior: 'smooth' }), 30)
    } catch { /**/ }
  }

  async function checkDMUnread() {
    try {
      const res = await fetch(`/api/chat/dm/unread?since=${dmUnreadSince.current}`, { credentials: 'include' })
      if (res.status === 401) { window.location.href = '/login'; return }
      if (!res.ok) { onPollFailure(); return }
      const { count, maxId, senderIds } = await res.json() as { count: number; maxId: number; senderIds: string[] }
      if (count > 0) {
        const viewing = activeTabR.current === 'direct' && dmWithR.current !== null
        if (!viewing) {
          setDmUnread(c => c + count)
          playNotifSound()
        }
        if (maxId) { dmUnreadSince.current = maxId; localStorage.setItem(`dm-since-${currentUser.id}`, String(maxId)) }
        if (senderIds.length) setDmUnreadFrom(prev => { const n = new Set(prev); senderIds.forEach(id => n.add(id)); return n })
      }
    } catch { /**/ }
  }

  async function loadDMUsers() {
    if (dmLoaded) return
    try {
      const res = await fetch('/api/chat/users', { credentials: 'include' })
      if (res.ok) { const { users } = await res.json() as { users: DmUser[] }; setDmUsers(users); setDmLoaded(true) }
    } catch { /**/ }
  }

  function playNotifSound() {
    try {
      const ctx = new AudioContext()
      const play = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator(); const gain = ctx.createGain()
        osc.type = 'sine'; osc.frequency.value = freq
        gain.gain.setValueAtTime(0, ctx.currentTime + start)
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
        osc.connect(gain); gain.connect(ctx.destination)
        osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur)
      }
      play(880, 0, 0.18); play(1100, 0.18, 0.22)
      setTimeout(() => ctx.close(), 600)
    } catch { /**/ }
  }

  async function pingAndRefreshOnline() {
    try {
      const ping = await fetch('/api/chat/ping', { method: 'POST', credentials: 'include' })
      if (ping.status === 401) { window.location.href = '/login'; return }
      const res = await fetch('/api/chat/online', { credentials: 'include' })
      if (res.ok) {
        const { users } = await res.json() as { users: { user_id: string }[] }
        setOnlineIds(new Set(users.map(u => u.user_id)))
        onPollSuccess()
      }
    } catch { onPollFailure() }
  }

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

  useEffect(() => {
    if (activeTab === 'direct') { loadDMUsers() }
    else { setMsgs([]); fetchCh(activeTab as Channel, false) }
  }, [activeTab]) // eslint-disable-line

  useEffect(() => {
    if (dmWith) { setDmMsgs([]); fetchDM(dmWith, 0); setDmUnread(0) }
  }, [dmWith?.id]) // eslint-disable-line

  useEffect(() => {
    setChUnread(u => ({ ...u, [activeTab]: 0 }))
    if (activeTab === 'direct') {
      if (dmWith) { setTimeout(() => dmBottomR.current?.scrollIntoView({ behavior: 'smooth' }), 50); setTimeout(() => dmInputR.current?.focus(), 80) }
    } else {
      setTimeout(() => bottomR.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      setTimeout(() => inputR.current?.focus(), 80)
    }
  }, [activeTab, msgs.length, dmMsgs.length]) // eslint-disable-line

  useEffect(() => { if (activeTab === 'direct' && dmWith) setDmUnread(0) }, [activeTab, dmWith])

  async function sendMsg() {
    if (!draft.trim() || sending || activeTab === 'direct') return
    setSending(true)
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft.trim(), channel: activeTab }),
      })
      if (res.ok) {
        const { message: m } = await res.json() as { message: ChatMsg }
        setMsgs(p => [...p, m]); chLastId.current[activeTab as Channel] = m.id
        setDraft(''); setTimeout(() => bottomR.current?.scrollIntoView({ behavior: 'smooth' }), 30)
      }
    } catch { /**/ } finally { setSending(false) }
  }

  async function sendDM() {
    if (!dmDraft.trim() || dmSending || !dmWith) return
    setDmSending(true)
    try {
      const res = await fetch('/api/chat/dm', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toUserId: dmWith.id, toUserName: dmWith.name, message: dmDraft.trim() }),
      })
      if (res.ok) {
        const { message: m } = await res.json() as { message: ChatMsg }
        setDmMsgs(p => [...p, m]); dmLastId.current[dmWith.id] = m.id
        setDmDraft(''); setTimeout(() => dmBottomR.current?.scrollIntoView({ behavior: 'smooth' }), 30)
      }
    } catch { /**/ } finally { setDmSending(false) }
  }

  function openDM(user: DmUser) {
    setDmWith(user); setDmSearch('')
    setDmUnread(0); setDmUnreadFrom(prev => { const n = new Set(prev); n.delete(user.id); return n })
  }

  const totalUnread   = Object.values(chUnread).reduce((s, n) => s + (n ?? 0), 0) + dmUnread
  const filteredUsers = dmUsers
    .filter(u => u.name.toLowerCase().includes(dmSearch.toLowerCase()) || u.department.toLowerCase().includes(dmSearch.toLowerCase()))
    .sort((a, b) => {
      const aU = dmUnreadFrom.has(a.id) ? 0 : 1; const bU = dmUnreadFrom.has(b.id) ? 0 : 1
      if (aU !== bU) return aU - bU
      const aO = onlineIds.has(a.id) ? 0 : 1; const bO = onlineIds.has(b.id) ? 0 : 1
      if (aO !== bO) return aO - bO
      return a.name.localeCompare(b.name)
    })
  const inDMConvo = activeTab === 'direct' && dmWith !== null

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', background: 'white' }}>

      {/* ── CHANNEL SIDEBAR ──────────────────────────────────────────────────── */}
      <div style={{ width: 200, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0, background: '#fafafa' }}>
        <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Channels</div>
        </div>
        {visTabs.map(t => {
          const u = t.id === 'direct' ? dmUnread : (chUnread[t.id as Channel] ?? 0)
          const isActive = activeTab === t.id
          return (
            <button key={t.id} onClick={() => { setActiveTab(t.id); if (t.id !== 'direct') setDmWith(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', border: 'none', background: isActive ? '#f0fdf4' : 'transparent', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: isActive ? 700 : 400, color: isActive ? '#1a3a2a' : '#374151', borderLeft: `3px solid ${isActive ? '#1a3a2a' : 'transparent'}`, transition: 'all 0.1s' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.label}</span>
              {u > 0 && <span style={{ background: '#ef4444', color: 'white', fontSize: 9, fontWeight: 800, minWidth: 17, height: 17, padding: '0 3px', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u > 99 ? '99+' : u}</span>}
            </button>
          )
        })}

        {/* Online count */}
        <div style={{ marginTop: 'auto', padding: '12px 14px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            {onlineIds.size} online
          </div>
        </div>
      </div>

      {/* ── MAIN CHAT AREA ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'white' }}>
          {inDMConvo ? (
            <>
              <button onClick={() => setDmWith(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#374151', padding: '0 4px' }}>←</button>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(dmWith!.name), color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(dmWith!.name)}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{dmWith!.name}</div>
                <div style={{ fontSize: 11, color: onlineIds.has(dmWith!.id) ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: onlineIds.has(dmWith!.id) ? '#22c55e' : '#d1d5db', display: 'inline-block' }} />
                  {onlineIds.has(dmWith!.id) ? 'Online' : 'Away'}
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 16 }}>{activeTab === 'all' ? '🌐' : activeTab === 'hod' ? '👔' : activeTab === 'finance' ? '💳' : '💬'}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  {visTabs.find(t => t.id === activeTab)?.label ?? ''}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Pabari Group · Internal</div>
              </div>
            </>
          )}
          {connState !== 'ok' && (
            <div style={{ marginLeft: 'auto', fontSize: 11, color: connState === 'lost' ? '#dc2626' : '#92400e', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span>{connState === 'lost' ? '⚠️' : '🔄'}</span>
              {connState === 'lost' ? 'Connection lost' : 'Reconnecting…'}
            </div>
          )}
        </div>

        {/* Messages — channel */}
        {activeTab !== 'direct' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {msgs.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 60 }}>No messages yet. Say hello!</div>}
            {msgs.map((msg, i) => <MsgBubble key={msg.id} msg={msg} i={i} list={msgs} myId={myId} />)}
            <div ref={bottomR} />
          </div>
        )}

        {/* Messages — DM conversation */}
        {inDMConvo && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {dmMsgs.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, marginTop: 60 }}>Start a private conversation with {dmWith!.name}</div>}
            {dmMsgs.map((msg, i) => <MsgBubble key={msg.id} msg={msg} i={i} list={dmMsgs} myId={myId} isDM />)}
            <div ref={dmBottomR} />
          </div>
        )}

        {/* DM user list */}
        {activeTab === 'direct' && !dmWith && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
              <input value={dmSearch} onChange={e => setDmSearch(e.target.value)} placeholder="Search people…"
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {filteredUsers.length === 0 && <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 12, padding: 32 }}>{dmLoaded ? 'No users found' : 'Loading…'}</div>}
              {filteredUsers.map(u => {
                const isOnline = onlineIds.has(u.id); const hasUnread = dmUnreadFrom.has(u.id)
                return (
                  <div key={u.id} onClick={() => openDM(u)}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', cursor: 'pointer', borderBottom: '1px solid #f9fafb', background: hasUnread ? '#fef2f2' : '' }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = hasUnread ? '#fee2e2' : '#f9fafb'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = hasUnread ? '#fef2f2' : ''}>
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(u.name), color: 'white', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(u.name)}</div>
                      <span style={{ position: 'absolute', bottom: 0, right: 0, width: 11, height: 11, borderRadius: '50%', background: isOnline ? '#22c55e' : '#d1d5db', border: '2px solid white', display: 'block' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: hasUnread ? 700 : 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div>
                      <div style={{ fontSize: 11, color: hasUnread ? '#dc2626' : isOnline ? '#16a34a' : '#9ca3af' }}>
                        {hasUnread ? 'New message' : isOnline ? 'Online' : u.department}
                      </div>
                    </div>
                    {hasUnread && <span style={{ background: '#dc2626', color: 'white', borderRadius: '50%', width: 18, height: 18, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>!</span>}
                    {!hasUnread && <div style={{ color: '#d1d5db', fontSize: 20 }}>›</div>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Input — channel */}
        {activeTab !== 'direct' && (
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: 'white' }}>
            <textarea ref={inputR} value={draft} onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
              placeholder={`Message ${visTabs.find(t => t.id === activeTab)?.label ?? ''}… (Enter to send)`}
              rows={1}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 100, overflowY: 'auto' }} />
            <SendBtn onClick={sendMsg} active={!!draft.trim() && !sending} />
          </div>
        )}

        {/* Input — DM */}
        {inDMConvo && (
          <div style={{ borderTop: '1px solid #f3f4f6', padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0, background: 'white' }}>
            <textarea ref={dmInputR} value={dmDraft} onChange={e => setDmDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDM() } }}
              placeholder={`Message ${dmWith!.name}… (Enter to send)`}
              rows={1}
              style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '9px 12px', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.4, maxHeight: 100, overflowY: 'auto' }} />
            <SendBtn onClick={sendDM} active={!!dmDraft.trim() && !dmSending} />
          </div>
        )}
      </div>
    </div>
  )
}
