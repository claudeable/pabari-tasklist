'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionUser } from '@/types'
import NotificationBell from './NotificationBell'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ActivityEntry {
  id: number
  user_name: string
  action: string
  details: string
  created_at: string
}

interface DashboardData {
  myTasks:            number
  overdueTasks:       number
  dueToday:           number
  completedToday:     number
  needsHkComment:     number
  awaitingHkApproval: number
  approvalsWaiting:   number
  approvalItems:      { label: string; href: string; type: string }[]
  highPriorityTasks:  { id: string; description: string; company: string; due_date: string }[]
  recentActivity:     { user_name: string; action: string; details: string; created_at: string }[]
  financeStats:       { draft: number; sent: number; overdue: number } | null
  today:              string
}

interface Session {
  user: string; loginAt: string; logoutAt: string | null; entries: ActivityEntry[]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACTION_LABELS: Record<string, { label: string; dot: string }> = {
  login:               { label: 'Logged in',              dot: '#15803d' },
  logout:              { label: 'Logged out',              dot: '#6b7280' },
  task_created:        { label: 'Created task',            dot: '#1d4ed8' },
  task_status_changed: { label: 'Changed task status',     dot: '#b45309' },
  task_commented:      { label: 'HK commented',            dot: '#7c3aed' },
  task_update_posted:  { label: 'Posted update',           dot: '#0891b2' },
  task_legal_flagged:  { label: 'Flagged for legal review',dot: '#7c3aed' },
  leave_submitted:     { label: 'Submitted leave',         dot: '#b5833a' },
  pcr_submitted:       { label: 'Submitted petty cash',    dot: '#b5833a' },
  leave_approved:      { label: 'Approved leave',          dot: '#15803d' },
  leave_rejected:      { label: 'Rejected leave',          dot: '#dc2626' },
  doc_uploaded:        { label: 'Uploaded document',       dot: '#7c3aed' },
  doc_downloaded:      { label: 'Downloaded document',     dot: '#0891b2' },
  invoice_created:     { label: 'Created invoice',         dot: '#059669' },
  invoice_updated:     { label: 'Updated invoice',         dot: '#b45309' },
}

const ACTION_FEED: Record<string, string> = {
  task_created:        'created a task',
  task_status_changed: 'updated a task status',
  task_update_posted:  'posted a task update',
  leave_submitted:     'submitted a leave request',
  pcr_submitted:       'submitted a petty cash request',
  leave_approved:      'approved a leave request',
  leave_rejected:      'rejected a leave request',
  doc_uploaded:        'uploaded a document',
  invoice_created:     'created an invoice/LPO',
  login:               'logged in',
}

const systems = [
  { key:'tasks',    icon:'✓',  iconBg:'#dbeafe', iconColor:'#1d4ed8', label:'Task Management',     href:'/tasks',            detail:'Pending · Assignments · Deadlines' },
  { key:'forms',    icon:'📋', iconBg:'#fef3c7', iconColor:'#b45309', label:'Forms',               href:'/forms',            detail:'Leave Requests · Petty Cash' },
  { key:'assets',   icon:'🗂️', iconBg:'#f0fdf4', iconColor:'#15803d', label:'Asset Directory',     href:'/asset-directory',  detail:'Assets · Fleet · Compliance', assetsOnly:true },
  { key:'projects', icon:'📐', iconBg:'#e0f2fe', iconColor:'#0369a1', label:'Projects',            href:'/projects',         detail:'Milestones · Gantt · Budget',   projectsOnly:true },
  { key:'docs',     icon:'📁', iconBg:'#f3e8ff', iconColor:'#7c3aed', label:'Documents',           href:'/documents',        detail:'Upload · Folders · View',        adminOnly:true },
  { key:'connect',  icon:'📇', iconBg:'#fef9ec', iconColor:'#b5833a', label:'Pabari Connect',      href:'/connect',          detail:'Contacts · Directory · Search', harshilOnly:true },
  { key:'security', icon:'🛡', iconBg:'#fee2e2', iconColor:'#dc2626', label:'Security Centre',     href:'/admin/security',   detail:'Threats · IP Blocking',         superAdminOnly:true },
]

function buildSessions(entries: ActivityEntry[]): Session[] {
  const asc = [...entries].reverse()
  const sessions: Session[] = []
  const open: Record<string, Session> = {}
  for (const e of asc) {
    if (e.action === 'login') {
      const s: Session = { user: e.user_name, loginAt: e.created_at, logoutAt: null, entries: [e] }
      open[e.user_name] = s; sessions.push(s)
    } else if (e.action === 'logout') {
      const s = open[e.user_name]
      if (s) { s.logoutAt = e.created_at; s.entries.push(e); delete open[e.user_name] }
      else sessions.push({ user: e.user_name, loginAt: e.created_at, logoutAt: e.created_at, entries: [e] })
    } else {
      const s = open[e.user_name]
      if (s) s.entries.push(e)
      else { const i: Session = { user: e.user_name, loginAt: e.created_at, logoutAt: null, entries: [e] }; open[e.user_name] = i; sessions.push(i) }
    }
  }
  return sessions.reverse()
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PortalHub({ currentUser }: { currentUser: SessionUser }) {
  const [isMobile, setIsMobile] = useState(false)
  const [dash,     setDash]     = useState<DashboardData | null>(null)
  const [dashLoading, setDashLoading] = useState(true)

  const firstName  = currentUser.name.split(' ')[0]
  const initials   = currentUser.name.split(/\s+/).map((w:string)=>w[0]).slice(0,2).join('').toUpperCase()
  const isDirector = currentUser.role === 'admin' ||
    (currentUser.role === 'director' && (currentUser.department === 'Director' || currentUser.department === 'Executive'))

  // Activity log state (directors/admin)
  const [activityLog,     setActivityLog]     = useState<ActivityEntry[]>([])
  const [activityFrom,    setActivityFrom]    = useState('')
  const [activityTo,      setActivityTo]      = useState('')
  const [activityUser,    setActivityUser]    = useState('')
  const [activityLoading, setActivityLoading] = useState(false)
  const [allUserNames,    setAllUserNames]    = useState<string[]>([])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/dashboard', { credentials:'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setDash(d) })
      .catch(() => {})
      .finally(() => setDashLoading(false))
  }, [])

  const fetchActivity = useCallback(() => {
    if (!isDirector) return
    setActivityLoading(true)
    const params = new URLSearchParams({ limit:'200' })
    if (activityFrom) params.set('from', activityFrom)
    if (activityTo)   params.set('to', activityTo)
    if (activityUser) params.set('user', activityUser)
    fetch(`/api/activity-log?${params}`, { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => setActivityLog(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setActivityLoading(false))
  }, [isDirector, activityFrom, activityTo, activityUser])

  useEffect(() => {
    if (!isDirector) return
    fetch('/api/users', { credentials:'include' }).then(r=>r.json())
      .then(data => { if (Array.isArray(data)) setAllUserNames(data.map((u:{name:string})=>u.name).sort()) })
      .catch(()=>{})
    fetchActivity()
  }, [isDirector]) // eslint-disable-line

  // ── Visible systems ──────────────────────────────────────────────────────────
  const ASSET_USERS = ['harshil', 'paul', 'krishna', 'yalelet']

  const visibleSystems = systems.filter(sys => {
    const s = sys as { adminOnly?:boolean; superAdminOnly?:boolean; projectsOnly?:boolean; harshilOnly?:boolean; assetsOnly?:boolean }
    const firstNameLower = currentUser.name.toLowerCase().split(' ')[0]
    if (s.superAdminOnly) return currentUser.role === 'admin'
    if (s.adminOnly) return currentUser.role === 'admin' || (currentUser.role === 'director' && currentUser.department === 'Director')
    if (s.harshilOnly) return currentUser.role === 'admin' || firstNameLower === 'harshil'
    if (s.projectsOnly) return currentUser.role === 'admin' || firstNameLower === 'harshil' || firstNameLower === 'benson'
    if (s.assetsOnly) return currentUser.role === 'admin' || ASSET_USERS.includes(firstNameLower)
    return true
  })

  const isHK = currentUser.role === 'admin' || (currentUser.role === 'director' && firstName.toLowerCase() === 'harshil')
  // Only admin, Harshil, and Benson see activity log, recent activity, and quick actions
  const canSeeActivity = currentUser.role === 'admin' || firstName.toLowerCase() === 'harshil' || firstName.toLowerCase() === 'benson' || firstName.toLowerCase() === 'yalelet'
  const hasAttention = (dash?.approvalsWaiting ?? 0) > 0 || (dash?.overdueTasks ?? 0) > 0 || (dash?.highPriorityTasks?.length ?? 0) > 0 || (isHK && (dash?.needsHkComment ?? 0) > 0)

  // ── Styles ───────────────────────────────────────────────────────────────────
  const card = { background:'white', borderRadius:12, border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' }
  const sectionTitle = { fontSize:13, fontWeight:700, color:'#374151', textTransform:'uppercase' as const, letterSpacing:'0.06em', marginBottom:12 }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#f3f4f6', fontFamily:'system-ui,-apple-system,sans-serif' }}>

      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <div style={{ background:'#1a3a2a', padding: isMobile ? '0 16px' : '0 32px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ background:'#b5833a', color:'white', fontWeight:800, fontSize:11, padding:'5px 10px', borderRadius:4, letterSpacing:'1px' }}>PABARI</div>
          {!isMobile && <span style={{ fontSize:13, color:'rgba(255,255,255,0.55)', fontWeight:500 }}>Work Hub</span>}
          {!isMobile && (
            <a href="/centre" style={{ fontSize:12, fontWeight:600, color:'white', textDecoration:'none', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', padding:'4px 10px', borderRadius:6, display:'flex', alignItems:'center', gap:5 }}>
              <span>📥</span> Centre
            </a>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <NotificationBell userEmail={currentUser.email} />
          {!isMobile && <span style={{ fontSize:13, color:'rgba(255,255,255,0.75)' }}>{currentUser.name}</span>}
          <div style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.15)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 }}>{initials}</div>
          <button onClick={signOut} style={{ background:'transparent', border:'1px solid rgba(255,255,255,0.3)', borderRadius:6, padding:'5px 12px', fontSize:12, color:'rgba(255,255,255,0.75)', cursor:'pointer' }}>
            {isMobile ? 'Out' : 'Sign out'}
          </button>
        </div>
      </div>

      {/* ── HERO GREETING ───────────────────────────────────────────────────── */}
      <div style={{ background:'linear-gradient(135deg, #1a3a2a 0%, #2d5a40 100%)', padding: isMobile ? '28px 16px 24px' : '36px 32px 32px' }}>
        <div style={{ maxWidth:1200, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ margin:0, fontSize: isMobile ? 22 : 28, fontWeight:700, color:'white' }}>
                {getGreeting()}, {firstName} 👋
              </h1>
              <p style={{ margin:'4px 0 0', fontSize:13, color:'rgba(255,255,255,0.65)' }}>
                {fmtDate(new Date())}
              </p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 14px' }}>
              <span style={{ fontSize:18 }}>
                {dashLoading ? '⏳' : (dash?.overdueTasks ?? 0) > 0 ? '🔴' : (dash?.approvalsWaiting ?? 0) > 0 ? '🟡' : '🟢'}
              </span>
              <div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600 }}>STATUS</div>
                <div style={{ fontSize:12, color:'white', fontWeight:700 }}>
                  {dashLoading ? 'Loading…' : (dash?.overdueTasks ?? 0) > 0 ? 'Action needed' : (dash?.approvalsWaiting ?? 0) > 0 ? 'Approvals waiting' : 'All clear'}
                </div>
              </div>
            </div>
          </div>

          {/* ── WORK TODAY STATS ──────────────────────────────────────────── */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : `repeat(${isHK ? 6 : 5},1fr)`, gap:10, marginTop:24 }}>
            {[
              { label:'My Tasks',        value: dash?.myTasks,          color:'#60a5fa', href:'/tasks',  icon:'📋' },
              { label:'Approvals',        value: dash?.approvalsWaiting, color:'#fbbf24', href:'/forms',  icon:'✅', alert: (dash?.approvalsWaiting ?? 0) > 0 },
              { label:'Overdue',          value: dash?.overdueTasks,     color:'#f87171', href:'/tasks',  icon:'⚠️', alert: (dash?.overdueTasks ?? 0) > 0 },
              { label:'Due Today',        value: dash?.dueToday,         color:'#a78bfa', href:'/tasks',  icon:'📅' },
              { label:'Completed Today',  value: dash?.completedToday,   color:'#34d399', href:'/tasks',  icon:'✓' },
              ...(isHK ? [{ label:'Needs Comment', value: dash?.needsHkComment, color:'#c084fc', href:'/tasks', icon:'💬', alert: (dash?.needsHkComment ?? 0) > 0 }] : []),
            ].map(stat => (
              <div key={stat.label} onClick={() => window.location.href = stat.href}
                style={{ background: stat.alert ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)', borderRadius:10, padding:'14px 16px', cursor:'pointer', border: stat.alert ? '1px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.1)', transition:'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.15)'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = stat.alert ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.08)'}
              >
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:600, marginBottom:6 }}>{stat.label}</div>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{ fontSize:28, fontWeight:800, color: dashLoading ? 'rgba(255,255,255,0.3)' : (stat.value ?? 0) > 0 ? stat.color : 'rgba(255,255,255,0.5)', lineHeight:1 }}>
                    {dashLoading ? '–' : (stat.value ?? 0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────────────────── */}
      <div style={{ maxWidth:1200, margin:'0 auto', padding: isMobile ? '16px 12px' : '24px 32px', display:'grid', gridTemplateColumns: isMobile ? '1fr' : canSeeActivity ? '1fr 340px' : '1fr', gap:20, alignItems:'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* ── ATTENTION REQUIRED ──────────────────────────────────────── */}
          {hasAttention && (
            <div style={card}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
                <div style={sectionTitle}>🔴 Needs Your Attention</div>
              </div>
              <div style={{ padding:'4px 0' }}>
                {(dash?.approvalsWaiting ?? 0) > 0 && dash?.approvalItems.map((item, i) => (
                  <a key={i} href={item.href} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid #f9fafb', textDecoration:'none', background:'white' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background='#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background='white'}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>✅</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{item.label}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>Waiting for your approval</div>
                    </div>
                    <span style={{ fontSize:12, color:'#b45309', fontWeight:600 }}>Review →</span>
                  </a>
                ))}
                {isHK && (dash?.needsHkComment ?? 0) > 0 && (
                  <a href="/tasks" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid #f9fafb', textDecoration:'none', background:'white' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background='#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background='white'}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>💬</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{dash?.needsHkComment} task{(dash?.needsHkComment??0)>1?'s':''} need{(dash?.needsHkComment??0)===1?'s':''} your comment</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>No HK comment added yet — pending your review</div>
                    </div>
                    <span style={{ fontSize:12, color:'#7c3aed', fontWeight:600 }}>Review →</span>
                  </a>
                )}
                {isHK && (dash?.awaitingHkApproval ?? 0) > 0 && (
                  <a href="/tasks" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid #f9fafb', textDecoration:'none', background:'white' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background='#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background='white'}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'#fef3c7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>⏳</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{dash?.awaitingHkApproval} task{(dash?.awaitingHkApproval??0)>1?'s':''} awaiting your approval</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>Status: awaiting-hk-approval</div>
                    </div>
                    <span style={{ fontSize:12, color:'#b45309', fontWeight:600 }}>Approve →</span>
                  </a>
                )}
                {(dash?.overdueTasks ?? 0) > 0 && (
                  <a href="/tasks" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid #f9fafb', textDecoration:'none', background:'white' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background='#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background='white'}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'#fee2e2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>⚠️</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827' }}>{dash?.overdueTasks} overdue task{(dash?.overdueTasks??0)>1?'s':''}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>Past due date — action required</div>
                    </div>
                    <span style={{ fontSize:12, color:'#dc2626', fontWeight:600 }}>View →</span>
                  </a>
                )}
                {(dash?.highPriorityTasks?.length ?? 0) > 0 && dash?.highPriorityTasks.map(t => (
                  <a key={t.id} href="/tasks" style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderBottom:'1px solid #f9fafb', textDecoration:'none', background:'white' }}
                    onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background='#fafafa'}
                    onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background='white'}>
                    <div style={{ width:36, height:36, borderRadius:8, background:'#ede9fe', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>🔺</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.description}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>{t.company}{t.due_date ? ` · Due ${t.due_date}` : ''}</div>
                    </div>
                    <span style={{ fontSize:11, background:'#fee2e2', color:'#dc2626', borderRadius:10, padding:'2px 8px', fontWeight:700, flexShrink:0 }}>High</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── MODULES GRID ────────────────────────────────────────────── */}
          <div style={card}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={sectionTitle}>⚡ Systems</div>
            </div>
            <div style={{ padding:16, display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap:10 }}>
              {visibleSystems.map(sys => (
                <div key={sys.key} onClick={() => window.location.href = sys.href}
                  style={{ padding:'14px 16px', borderRadius:10, border:'1px solid #e5e7eb', cursor:'pointer', transition:'all 0.15s', position:'relative' }}
                  onMouseEnter={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor='#1a3a2a'; d.style.background='#f0fdf4' }}
                  onMouseLeave={e => { const d = e.currentTarget as HTMLDivElement; d.style.borderColor='#e5e7eb'; d.style.background='transparent' }}>
                  {sys.key === 'forms' && (dash?.approvalsWaiting ?? 0) > 0 && (
                    <span style={{ position:'absolute', top:8, right:8, background:'#ef4444', color:'white', fontSize:10, fontWeight:700, minWidth:18, height:18, padding:'0 5px', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      {dash?.approvalsWaiting}
                    </span>
                  )}
                  <div style={{ width:36, height:36, borderRadius:8, background:sys.iconBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, marginBottom:10 }}>
                    {sys.icon}
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:3 }}>{sys.label}</div>
                  <div style={{ fontSize:11, color:'#9ca3af' }}>{sys.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ACTIVITY LOG (admin / Harshil / Benson only) ────────────── */}
          {canSeeActivity && (
            <div style={card}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={sectionTitle}>📋 Activity Log</div>
              </div>
              <div style={{ padding:'12px 16px', borderBottom:'1px solid #f3f4f6', display:'flex', flexWrap:'wrap', gap:8, alignItems:'flex-end' }}>
                {[
                  { label:'From', value:activityFrom, onChange:(v:string)=>setActivityFrom(v), type:'date' },
                  { label:'To',   value:activityTo,   onChange:(v:string)=>setActivityTo(v),   type:'date' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>{f.label}</div>
                    <input type={f.type} value={f.value} onChange={e=>f.onChange(e.target.value)}
                      style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'5px 8px', fontSize:12 }} />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:3 }}>User</div>
                  <select value={activityUser} onChange={e=>setActivityUser(e.target.value)}
                    style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'5px 8px', fontSize:12, color:'#374151' }}>
                    <option value="">All Users</option>
                    {allUserNames.map(n=><option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <button onClick={fetchActivity} style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:5, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  {activityLoading ? 'Loading…' : 'Filter'}
                </button>
                <button onClick={()=>{setActivityFrom('');setActivityTo('');setActivityUser('')}}
                  style={{ background:'#f3f4f6', color:'#374151', border:'none', borderRadius:5, padding:'6px 12px', fontSize:12, cursor:'pointer' }}>
                  Reset
                </button>
              </div>
              <div style={{ padding:'8px 0', maxHeight:500, overflow:'auto' }}>
                {activityLoading ? (
                  <div style={{ padding:32, textAlign:'center', color:'#9ca3af', fontSize:13 }}>Loading…</div>
                ) : activityLog.length === 0 ? (
                  <div style={{ padding:32, textAlign:'center', color:'#9ca3af', fontSize:13 }}>No activity recorded yet.</div>
                ) : (() => {
                  const sessions = buildSessions(activityLog)
                  const fmtShort = (ts:string) => new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
                  const fmtDay   = (ts:string) => new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'0 12px' }}>
                      {sessions.map((session, si) => {
                        const actions = session.entries.filter(e=>e.action!=='login'&&e.action!=='logout').length
                        const stillActive = !session.logoutAt
                        return (
                          <div key={si} style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                            <div style={{ background: stillActive?'#f0fdf4':'#f9fafb', borderBottom:'1px solid #e5e7eb', padding:'7px 12px', display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:26,height:26,borderRadius:'50%',background:'#1a3a2a',color:'white',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                                {session.user.split(' ').map((w:string)=>w[0]).join('').toUpperCase().slice(0,2)}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <span style={{ fontWeight:700, fontSize:12, color:'#111827' }}>{session.user}</span>
                                <span style={{ fontSize:11, color:'#6b7280', marginLeft:8 }}>
                                  {fmtDay(session.loginAt)} · {fmtShort(session.loginAt)}{session.logoutAt?` – ${fmtShort(session.logoutAt)}`:''}
                                </span>
                              </div>
                              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                                {stillActive && <span style={{ fontSize:9, fontWeight:700, background:'#dcfce7', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:10, padding:'1px 7px' }}>ACTIVE</span>}
                                {actions > 0 && <span style={{ fontSize:10, color:'#9ca3af' }}>{actions} action{actions!==1?'s':''}</span>}
                              </div>
                            </div>
                            <div style={{ padding:'2px 0' }}>
                              {session.entries.map((entry,ei) => {
                                const meta = ACTION_LABELS[entry.action] ?? {label:entry.action,dot:'#9ca3af'}
                                return (
                                  <div key={entry.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'6px 12px', borderBottom:ei<session.entries.length-1?'1px solid #f9fafb':'none' }}>
                                    <span style={{ width:6,height:6,borderRadius:'50%',background:meta.dot,display:'block',flexShrink:0,marginTop:4 }}/>
                                    <div style={{ flex:1, minWidth:0 }}>
                                      <div style={{ display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap' }}>
                                        <span style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{meta.label}</span>
                                        <span style={{ fontSize:10, color:'#9ca3af' }}>{fmtShort(entry.created_at)}</span>
                                      </div>
                                      {entry.details && <div style={{ fontSize:11, color:'#6b7280', marginTop:1 }}>{entry.details}</div>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
                <div style={{ fontSize:11, color:'#9ca3af', textAlign:'right', padding:'6px 16px' }}>{activityLog.length} entries</div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN — only admin / Harshil / Benson */}
        {canSeeActivity && <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

          {/* ── FINANCE SNAPSHOT ────────────────────────────────────────── */}
          {dash?.financeStats ? (
            <div style={card}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
                <div style={sectionTitle}>💳 Finance Snapshot</div>
              </div>
              <div style={{ padding:16, display:'flex', flexDirection:'column', gap:8 }}>
                {[
                  { label:'Draft',   value: dash.financeStats.draft,   color:'#6b7280', bg:'#f9fafb' },
                  { label:'Sent',    value: dash.financeStats.sent,    color:'#1d4ed8', bg:'#eff6ff' },
                  { label:'Overdue', value: dash.financeStats.overdue, color:'#dc2626', bg:'#fef2f2', alert: dash.financeStats.overdue > 0 },
                ].map(row => (
                  <a key={row.label} href="/finance" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:row.bg, borderRadius:8, textDecoration:'none', border: row.alert ? '1px solid #fecaca' : '1px solid transparent' }}>
                    <span style={{ fontSize:13, color:row.color, fontWeight:600 }}>{row.label}</span>
                    <span style={{ fontSize:18, fontWeight:800, color:row.color }}>{row.value}</span>
                  </a>
                ))}
                <a href="/finance" style={{ fontSize:12, color:'#1a3a2a', fontWeight:600, textDecoration:'none', textAlign:'right', marginTop:4 }}>Open Finance →</a>
              </div>
            </div>
          ) : (
            /* ── RECENT ACTIVITY FEED (everyone else) ────────────────────── */
            <div style={card}>
              <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
                <div style={sectionTitle}>🕐 Recent Activity</div>
              </div>
              <div style={{ padding:'4px 0' }}>
                {dashLoading ? (
                  <div style={{ padding:'20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>Loading…</div>
                ) : (dash?.recentActivity?.length ?? 0) === 0 ? (
                  <div style={{ padding:'20px', textAlign:'center', color:'#9ca3af', fontSize:13 }}>No recent activity</div>
                ) : dash?.recentActivity.map((entry, i) => {
                  const meta = ACTION_LABELS[entry.action] ?? { dot:'#9ca3af', label:entry.action }
                  const feedLabel = ACTION_FEED[entry.action] ?? entry.action
                  return (
                    <div key={i} style={{ display:'flex', gap:10, padding:'10px 16px', borderBottom: i < (dash.recentActivity.length-1) ? '1px solid #f9fafb' : 'none' }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#374151', flexShrink:0 }}>
                        {entry.user_name.split(' ').map((w:string)=>w[0]).join('').toUpperCase().slice(0,2)}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:12, color:'#111827', lineHeight:1.4 }}>
                          <span style={{ fontWeight:600 }}>{entry.user_name.split(' ')[0]}</span>
                          {' '}<span style={{ color:'#6b7280' }}>{feedLabel}</span>
                        </div>
                        {entry.details && <div style={{ fontSize:11, color:'#9ca3af', marginTop:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{entry.details}</div>}
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:meta.dot, display:'inline-block' }}/>
                          <span style={{ fontSize:10, color:'#9ca3af' }}>{timeAgo(entry.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ padding:'10px 16px', borderTop:'1px solid #f3f4f6' }}>
                <a href="/audit" style={{ fontSize:12, color:'#1a3a2a', fontWeight:600, textDecoration:'none' }}>View full activity log →</a>
              </div>
            </div>
          )}

          {/* ── QUICK ACTIONS ───────────────────────────────────────────── */}
          <div style={card}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6' }}>
              <div style={sectionTitle}>⚡ Quick Actions</div>
            </div>
            <div style={{ padding:12, display:'flex', flexDirection:'column', gap:6 }}>
              {[
                { label:'Submit Leave Request',      href:'/forms/leave/new',          icon:'📅' },
                { label:'New Petty Cash Request',    href:'/forms/petty-cash/new',     icon:'💵' },
                { label:'View My Tasks',             href:'/tasks',                    icon:'✓'  },
                { label:'PCR Reports',               href:'/reports/petty-cash',       icon:'📊' },
              ].map(action => (
                <a key={action.href} href={action.href}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, textDecoration:'none', color:'#374151', fontSize:13, fontWeight:500, transition:'background 0.1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLAnchorElement).style.background='#f0fdf4'}
                  onMouseLeave={e=>(e.currentTarget as HTMLAnchorElement).style.background='transparent'}>
                  <span style={{ fontSize:16 }}>{action.icon}</span>
                  {action.label}
                </a>
              ))}
            </div>
          </div>

        </div>}
      </div>
    </div>
  )
}
