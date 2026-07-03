'use client'

import { useState, useMemo, useEffect } from 'react'
import InactivityGuard from './InactivityGuard'
import {
  Task, TaskStatus, TaskUpdate,
  STATUS_LABELS, STATUS_OPTIONS_BY_ROLE, PRIORITY_LABELS, PRIORITY_STYLE, TaskPriority,
  COMPANIES, SECTIONS, PEOPLE, CATEGORIES,
  SessionUser, PublicUser,
} from '@/types'

// ── Helpers ────────────────────────────────────────────────────────
const STATUS_PILL: Record<TaskStatus, string> = {
  'pending-discussion':    'pill pill-pending',
  'action-required':       'pill pill-action',
  'in-review':             'pill pill-review',
  'awaiting-hod-approval': 'pill pill-hod',
  'awaiting-hk-approval':  'pill pill-hk',
  'resolved':              'pill pill-resolved',
  'expired':               'pill pill-expired',
}
const AVATAR_COLORS: Record<string, string> = {
  harshil: '#b5833a', sabina: '#6c5ce7', ahmad: '#e17055',
  ashok: '#0984e3', paul: '#2d6a4f', krishnan: '#00b894',
  yalelet: '#fd79a8', suresh: '#5f27cd', benson: '#00cec9',
  andu: '#d63031', yared: '#e84393', simon: '#74b9ff',
  rajveer: '#a29bfe', pedro: '#2d3436',
}
const BORDER: Record<TaskStatus, string> = {
  'action-required':       '#dc2626',
  'pending-discussion':    '#d97706',
  'in-review':             '#1d4ed8',
  'awaiting-hod-approval': '#5b21b6',
  'awaiting-hk-approval':  '#9d174d',
  'resolved':              '#15803d',
  'expired':               '#7f1d1d',
}

function nameMatch(responsible: string, name: string): boolean {
  return responsible
    .split(/\s*[&/]\s*/)
    .some(n => n.trim().toLowerCase() === name.trim().toLowerCase())
}
function avatarInitials(name: string) {
  return name.split(/[\s&./]+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}
function avatarColor(name: string) {
  return AVATAR_COLORS[name.toLowerCase().split(/[\s&./]+/)[0]] || '#2d6a4f'
}

interface ParsedEntry { label: string; text: string; isHK: boolean }
function parseUpdates(updates: string): ParsedEntry[] {
  if (!updates?.trim()) return []
  // Split on date patterns (DD/MM/YY: DD.MM.YY: DD.MM:) and HK: markers
  const DATE_RE = /(\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?:|HK:)/
  const parts = updates.split(DATE_RE)
  const result: ParsedEntry[] = []
  // parts[0] is any text before the first marker; pairs [i]=label [i+1]=text follow
  if (parts[0].trim()) result.push({ label: '', text: parts[0].trim(), isHK: false })
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const label = parts[i].replace(':', '').trim()
    const text  = (parts[i + 1] || '').trim()
    if (text) result.push({ label, text, isHK: label === 'HK' })
  }
  return result
}
function todayStr() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getFullYear()).slice(2)}`
}
function fmtDate() {
  const d = new Date()
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d.getDate()}-${m[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`
}
function weekNum() {
  const d = new Date(), s = new Date(d.getFullYear(), 0, 1)
  return `WK-${Math.ceil(((d.getTime()-s.getTime())/86400000+s.getDay()+1)/7)}`
}
function sectionShort(s: string) {
  return (s || '')
    .replace('External Stakeholders - Non-Payment','Ext. Non-Pay')
    .replace('External Stakeholders - Payment','Ext. Payment')
    .replace('Staff - Non-Salary','Staff/Non-Sal')
    .replace('Staff - Salary','Staff/Salary')
    .replace('Internal Non-Payment','Internal')
    .replace('Put on Hold','Hold')
}

const ROLE_BADGE: Record<string, {bg:string;color:string;label:string}> = {
  admin:    { bg:'#1a3a2a', color:'white',   label:'ADMIN'    },
  director: { bg:'#b5833a', color:'white',   label:'DIRECTOR' },
  manager:  { bg:'#1d4ed8', color:'white',   label:'MANAGER'  },
  staff:    { bg:'#f3f4f6', color:'#374151', label:'STAFF'    },
}

// ── Component ──────────────────────────────────────────────────────
interface Props {
  initialTasks:  Task[]
  currentUser:   SessionUser
  allUsers:      PublicUser[]
  subordinates?: string[]
}

export default function TaskBoard({ initialTasks, currentUser, allUsers: initialUsers, subordinates = [] }: Props) {
  // ── State ────────────────────────────────────────────────────────
  const [tasks,         setTasks]         = useState<Task[]>(initialTasks)
  const [allUsers,      setAllUsers]      = useState<PublicUser[]>(initialUsers)
  const [search,        setSearch]        = useState('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterSection,   setFilterSection]   = useState('')
  const [filterStatus,    setFilterStatus]    = useState('')
  const [filterPriority,  setFilterPriority]  = useState('')
  const [filterPerson,    setFilterPerson]    = useState('')

  const showCompanyCol = filterCompany === ''
  const [expandedRows,  setExpandedRows]  = useState<Set<string>>(new Set())
  const [activeTask,    setActiveTask]    = useState<Task | null>(null)
  const [showAddForm,   setShowAddForm]   = useState(false)
  const [comment,       setComment]       = useState('')
  const [saving,        setSaving]        = useState(false)
  const [viewAs,        setViewAs]        = useState('')   // name of person being viewed as
  const [hkEditId,      setHkEditId]      = useState<string|null>(null)
  const [hkDraft,       setHkDraft]       = useState('')
  const [hodEditId,     setHodEditId]     = useState<string|null>(null)
  const [hodDraft,      setHodDraft]      = useState('')
  const [swkEditId,     setSwkEditId]     = useState<string|null>(null)
  const [swkDraft,      setSwkDraft]      = useState('')
  const [activeMainTab, setActiveMainTab] = useState<'active'|'pending-review'|'resolved'>('active')
  const [directorFilter, setDirectorFilter] = useState<'pending-review'|'needs-comment'|'action-required'|''>('')
  const [showChangePw,   setShowChangePw]   = useState(false)
  const [pwForm,         setPwForm]         = useState({ current:'', next:'', confirm:'' })
  const [pwError,        setPwError]        = useState('')
  const [pwSuccess,      setPwSuccess]      = useState(false)
  const [pwSaving,       setPwSaving]       = useState(false)

  // ── Print / PDF export ───────────────────────────────────────────
  const handlePrint = () => {
    const title = filterCompany || 'All Companies'
    const dateStr = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    const filters = [
      filterSection  && `Section: ${filterSection}`,
      filterStatus   && `Status: ${STATUS_LABELS[filterStatus as TaskStatus] || filterStatus}`,
      filterPriority && `Priority: ${PRIORITY_LABELS[filterPriority as TaskPriority] || filterPriority}`,
      filterPerson   && `Person: ${filterPerson}`,
      search         && `Search: "${search}"`,
    ].filter(Boolean).join(' · ')

    const rows = filtered.map(t => `
      <tr>
        <td>${t.sno}</td>
        <td>${t.date || ''}</td>
        ${!filterCompany ? `<td><strong>${t.company}</strong></td>` : ''}
        <td>${t.section.replace('External Stakeholders - ','Ext. ').replace(' PENDING LIST','')}</td>
        <td>${t.category || ''}</td>
        <td><strong>${t.particulars}</strong></td>
        <td>${(t.task_updates?.[0]
          ? `${t.task_updates[0].date}: ${t.task_updates[0].text}`
          : t.updates || ''
        ).slice(0, 200)}</td>
        <td>${t.responsible || ''}</td>
        <td>${STATUS_LABELS[t.status]}${t.priority && t.priority !== 'medium' ? ` · ${PRIORITY_LABELS[t.priority as TaskPriority] || t.priority}` : ''}</td>
      </tr>`).join('')

    const companyTh = !filterCompany ? '<th>Company</th>' : ''

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
      <title>Pabari Group — ${title}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 9pt; color: #111; }
        .header { background: #1a3a2a; color: white; padding: 12px 16px; display: flex; align-items: center; gap: 12px; }
        .badge { background: #b5833a; color: white; font-weight: 800; font-size: 10pt; padding: 3px 8px; border-radius: 3px; }
        .header h1 { font-size: 13pt; font-weight: 700; }
        .meta { padding: 8px 16px; font-size: 8pt; color: #555; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; }
        table { width: 100%; border-collapse: collapse; margin-top: 0; }
        th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 5px 6px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3px; text-align: left; }
        td { border: 1px solid #e5e7eb; padding: 5px 6px; font-size: 8pt; vertical-align: top; }
        tr:nth-child(even) td { background: #fafafa; }
        .footer { margin-top: 10px; font-size: 7.5pt; color: #999; text-align: right; padding: 0 16px; }
        @page { size: A4 landscape; margin: 12mm; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>
      <div class="header">
        <span class="badge">PABARI</span>
        <h1>PABARI GROUP &mdash; Pending Task Report</h1>
      </div>
      <div class="meta">
        <span><strong>${title}</strong>${filters ? ' · ' + filters : ''} &nbsp;|&nbsp; ${filtered.length} tasks</span>
        <span>Generated: ${dateStr}</span>
      </div>
      <table>
        <thead><tr>
          <th>#</th><th>Date</th>${companyTh}<th>Section</th><th>Category</th>
          <th>Particulars</th><th>Latest Update</th><th>Responsible</th><th>Status</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="footer">PABARI GROUP · Internal Use Only · ${dateStr}</div>
      <script>window.onload=()=>window.print()</script>
    </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  // Fetch fresh user list client-side so View As is never empty
  useEffect(() => {
    fetch('/api/users', { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAllUsers(data) })
      .catch(() => {})
  }, [])

  const [form, setForm] = useState({
    company:'BYTEWISE', date:fmtDate(), section:'General', category:'Other',
    particulars:'', responsible:currentUser.name,
    payment:'Non-Payment', status:'pending-discussion' as TaskStatus,
    priority:'medium' as TaskPriority,
    initial_update:'', hk_comment:'', status_wk:'',
  })

  // ── Roles & permissions ──────────────────────────────────────────
  // effectiveRole: what role rules apply right now (viewAs overrides to 'staff')
  const effectiveRole = viewAs ? 'staff' : currentUser.role
  const effectiveName = viewAs || currentUser.name

  const perms = useMemo(() => ({
    canAddTask:      effectiveRole !== 'staff',
    canDelete:       currentUser.role === 'admin',
    canChangeStatus: effectiveRole !== 'staff',
    canHKComment:    ['admin','director'].includes(currentUser.role),
    canViewAs:       ['admin','director'].includes(currentUser.role),
    canPostUpdate:   (task: Task) =>
      effectiveRole !== 'staff' || nameMatch(task.responsible, effectiveName),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [currentUser.role, effectiveRole, effectiveName])

  // ── Visible tasks (role-based) ───────────────────────────────────
  const visibleTasks = useMemo(() => {
    if (effectiveRole === 'staff') {
      return tasks.filter(t => nameMatch(t.responsible, effectiveName))
    }
    if (effectiveRole === 'manager') {
      // HOD sees own tasks + tasks of their direct reports
      const myNames = [currentUser.name, ...subordinates]
      return tasks.filter(t => myNames.some(n => nameMatch(t.responsible, n)))
    }
    return tasks // director / admin see everything
  }, [tasks, effectiveRole, effectiveName, currentUser.name, subordinates])

  // ── Per-company counts (based on visible tasks) ──────────────────
  const companyCounts = useMemo(() => {
    const m: Record<string,number> = {}
    visibleTasks.forEach(t => { m[t.company] = (m[t.company]||0)+1 })
    return m
  }, [visibleTasks])

  // ── Base set for KPIs (company-filtered visible tasks) ───────────
  const base = useMemo(() =>
    filterCompany ? visibleTasks.filter(t => t.company === filterCompany) : visibleTasks,
    [visibleTasks, filterCompany]
  )

  const availableSections = useMemo(() =>
    Array.from(new Set(base.map(t => t.section).filter(Boolean))).sort(),
    [base]
  )

  const availablePeople = useMemo(() => {
    const names = new Set<string>()
    tasks.forEach(t => {
      t.responsible.split(/\s*[&/]\s*/).map(n => n.trim()).filter(Boolean).forEach(n => names.add(n))
    })
    return Array.from(names).sort()
  }, [tasks])

  const dirAttention = useMemo(() => ({
    pendingReview:  visibleTasks.filter(t => t.status === 'in-review'),
    needsComment:   visibleTasks.filter(t => !t.hk_comment?.trim() && t.status !== 'resolved' && t.status !== 'expired'),
    actionRequired: visibleTasks.filter(t => t.status === 'action-required'),
  }), [visibleTasks])

  const filtered = useMemo(() => {
    let list = base
    if (directorFilter === 'pending-review')   list = visibleTasks.filter(t => t.status === 'in-review')
    if (directorFilter === 'needs-comment')     list = visibleTasks.filter(t => !t.hk_comment?.trim() && t.status !== 'resolved' && t.status !== 'expired')
    if (directorFilter === 'action-required')   list = visibleTasks.filter(t => t.status === 'action-required')
    return list.filter(t => {
      if (!directorFilter && filterSection  && t.section   !== filterSection)              return false
      if (!directorFilter && filterStatus   && t.status    !== filterStatus)               return false
      if (filterPriority  && t.priority     !== filterPriority)                            return false
      if (filterPerson    && !nameMatch(t.responsible, filterPerson))                      return false
      if (search && !JSON.stringify(t).toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [base, visibleTasks, directorFilter, filterSection, filterStatus, filterPriority, filterPerson, search])

  const kpis = useMemo(() => ({
    total:    base.filter(t=>t.status!=='resolved').length,
    action:   base.filter(t=>t.status==='action-required').length,
    pending:  base.filter(t=>t.status==='pending-discussion').length,
    review:   base.filter(t=>t.status==='in-review').length,
    resolved: base.filter(t=>t.status==='resolved').length,
  }), [base])

  // ── Pending My Review & Resolved tabs ────────────────────────────
  const pendingMyReview = useMemo(() => {
    if (currentUser.role === 'director' || currentUser.role === 'admin') {
      return visibleTasks.filter(t => t.status === 'awaiting-hk-approval')
    }
    if (currentUser.role === 'manager') {
      return visibleTasks.filter(t =>
        t.status === 'awaiting-hod-approval' &&
        subordinates.some(s => nameMatch(t.responsible, s))
      )
    }
    return []
  }, [visibleTasks, currentUser.role, subordinates])

  const resolvedTasks = useMemo(() =>
    visibleTasks.filter(t => t.status === 'resolved'),
    [visibleTasks]
  )

  // ── Actions ──────────────────────────────────────────────────────
  function toggleRow(id: string) {
    setExpandedRows(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n
    })
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    if (!perms.canChangeStatus) return
    await fetch(`/api/tasks/${task.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status }),
    })
    setTasks(prev => prev.map(t => t.id===task.id ? {...t,status} : t))
    if (activeTask?.id===task.id) setActiveTask(p => p ? {...p,status} : p)
  }

  async function saveHODComment(taskId: string, text: string) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ hod_comment: text }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTasks(prev => prev.map(t => t.id===taskId ? updated : t))
      if (activeTask?.id===taskId) setActiveTask(updated)
    }
    setHodEditId(null); setHodDraft('')
  }

  async function approveTask(task: Task) {
    await changeStatus(task, 'resolved')
  }

  async function escalateToHK(task: Task) {
    await changeStatus(task, 'awaiting-hk-approval')
  }

  async function saveHKComment(taskId: string, comment: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ hk_comment: comment }),
    })
    setTasks(prev => prev.map(t => t.id===taskId ? {...t,hk_comment:comment} : t))
    setActiveTask(p => p?.id===taskId ? {...p,hk_comment:comment} : p)
    setHkEditId(null); setHkDraft('')
  }

  async function saveStatusWk(taskId: string, text: string) {
    await fetch(`/api/tasks/${taskId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status_wk: text }),
    })
    setTasks(prev => prev.map(t => t.id===taskId ? {...t,status_wk:text} : t))
    setActiveTask(p => p?.id===taskId ? {...p,status_wk:text} : p)
    setSwkEditId(null); setSwkDraft('')
  }

  async function postUpdate() {
    if (!comment.trim() || !activeTask || !perms.canPostUpdate(activeTask)) return
    setSaving(true)
    const res = await fetch(`/api/tasks/${activeTask.id}/updates`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date:todayStr(), text:comment.trim() }),
    })
    const { update } = await res.json()
    const u = update as TaskUpdate
    setTasks(prev => prev.map(t => t.id===activeTask.id
      ? {...t, task_updates:[u,...(t.task_updates||[])]} : t))
    setActiveTask(p => p ? {...p, task_updates:[u,...(p.task_updates||[])]} : p)
    setComment(''); setSaving(false)
  }

  async function addTask() {
    if (!form.particulars.trim() || !perms.canAddTask) return
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        ...form, sno:tasks.filter(t=>t.company===form.company).length+1, update_date:todayStr(),
      }),
    })
    const { task } = await res.json()
    const withUpdates: Task = {
      ...task,
      task_updates: form.initial_update
        ? [{id:'tmp-'+Date.now(),task_id:task.id,date:todayStr(),text:form.initial_update,created_at:new Date().toISOString()}]
        : [],
    }
    setTasks(prev => [...prev, withUpdates])
    setShowAddForm(false)
    setForm(f => ({...f,date:fmtDate(),section:'General',category:'Other',particulars:'',
      payment:'Non-Payment',status:'pending-discussion',priority:'medium',initial_update:'',hk_comment:'',status_wk:''}))
    setSaving(false)
  }

  async function deleteTask(id: string) {
    if (!perms.canDelete) return
    if (!confirm('Delete this task permanently?')) return
    await fetch(`/api/tasks/${id}`, { method:'DELETE' })
    setTasks(prev => prev.filter(t => t.id!==id))
    if (activeTask?.id===id) setActiveTask(null)
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method:'POST' })
    window.location.href = '/login'
  }

  // ── Derived for UI ───────────────────────────────────────────────
  const rb = ROLE_BADGE[currentUser.role] || ROLE_BADGE.staff
  const viewAsUsers = allUsers.filter(u => u.name !== currentUser.name)

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden'}}>
      <InactivityGuard />

      {/* TOP NAV */}
      <div style={{background:'#1a3a2a',padding:'0 18px',display:'flex',alignItems:'center',gap:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        <span style={{fontSize:13,fontWeight:700,color:'white',letterSpacing:'0.2px'}}>PABARI GROUP</span>
        <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
        {currentUser.role !== 'staff' && (
          <a href="/dashboard" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12,fontWeight:400}}>Dashboard</a>
        )}
        <a href="/tasks" style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>Task Board</a>
        {currentUser.role !== 'staff' && (
          <a href="/reports" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12,fontWeight:400}}>Reports</a>
        )}
        {currentUser.role === 'admin' && (
          <a href="/admin/users" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12,fontWeight:400}}>Users</a>
        )}
        <div style={{flex:1}}/>

        <span style={{background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.8)',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:14}}>{weekNum()}</span>

        {/* User chip */}
        <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.08)',borderRadius:20,padding:'3px 10px 3px 5px'}}>
          <div style={{width:24,height:24,borderRadius:'50%',background:avatarColor(currentUser.name),color:'white',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {avatarInitials(currentUser.name)}
          </div>
          <span style={{fontSize:12,color:'white',fontWeight:500}}>{currentUser.name}</span>
          <span style={{background:rb.bg,color:rb.color,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:8,marginLeft:2}}>
            {rb.label}
          </span>
        </div>

        {perms.canAddTask && (
          <button onClick={()=>setShowAddForm(v=>!v)}
            style={{background:'#b5833a',color:'white',border:'none',padding:'6px 13px',borderRadius:5,fontSize:12,fontWeight:600,cursor:'pointer'}}>
            + New Task
          </button>
        )}

        <button onClick={()=>{setShowChangePw(true);setPwForm({current:'',next:'',confirm:''});setPwError('');setPwSuccess(false)}}
          style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.15)',padding:'5px 11px',borderRadius:5,fontSize:11,cursor:'pointer'}}>
          Change Password
        </button>

        <button onClick={signOut}
          style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.15)',padding:'5px 11px',borderRadius:5,fontSize:11,cursor:'pointer'}}>
          Sign Out
        </button>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showChangePw && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowChangePw(false)}}>
          <div style={{background:'white',borderRadius:8,padding:'28px 32px',width:360,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:15,color:'#111827'}}>Change Password</div>
              <button onClick={()=>setShowChangePw(false)} style={{background:'none',border:'none',fontSize:18,color:'#9ca3af',cursor:'pointer',lineHeight:1}}>✕</button>
            </div>

            {pwSuccess
              ? <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'14px 16px',textAlign:'center'}}>
                  <div style={{fontSize:22,marginBottom:8}}>✓</div>
                  <div style={{fontWeight:600,color:'#15803d',fontSize:13}}>Password changed successfully.</div>
                  <button onClick={()=>setShowChangePw(false)}
                    style={{marginTop:14,background:'#1a3a2a',color:'white',border:'none',borderRadius:5,padding:'7px 20px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    Close
                  </button>
                </div>
              : <>
                  {[
                    {label:'Current Password', key:'current', ph:'Enter your current password'},
                    {label:'New Password',      key:'next',    ph:'At least 8 characters'},
                    {label:'Confirm New',       key:'confirm', ph:'Repeat new password'},
                  ].map(f=>(
                    <div key={f.key} style={{marginBottom:14}}>
                      <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4}}>{f.label}</label>
                      <input type="password" value={(pwForm as any)[f.key]}
                        onChange={e=>setPwForm(p=>({...p,[f.key]:e.target.value}))}
                        placeholder={f.ph}
                        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:5,padding:'8px 10px',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}/>
                    </div>
                  ))}

                  {pwError && (
                    <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:5,padding:'8px 11px',fontSize:12,color:'#dc2626',marginBottom:12}}>
                      {pwError}
                    </div>
                  )}

                  <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:4}}>
                    <button onClick={()=>setShowChangePw(false)}
                      style={{border:'1px solid #d1d5db',background:'white',borderRadius:5,padding:'7px 16px',fontSize:12,cursor:'pointer'}}>
                      Cancel
                    </button>
                    <button disabled={pwSaving} onClick={async()=>{
                      setPwError('')
                      if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwError('All fields are required.'); return }
                      if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return }
                      if (pwForm.next.length < 8) { setPwError('New password must be at least 8 characters.'); return }
                      setPwSaving(true)
                      try {
                        const res = await fetch('/api/auth/change-password', {
                          method:'POST', headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
                        })
                        const data = await res.json()
                        if (!res.ok) { setPwError(data.error || 'Failed to change password.') }
                        else { setPwSuccess(true) }
                      } catch { setPwError('Network error. Please try again.') }
                      finally { setPwSaving(false) }
                    }}
                      style={{background:pwSaving?'#9ca3af':'#1a3a2a',color:'white',border:'none',borderRadius:5,padding:'7px 18px',fontSize:12,fontWeight:600,cursor:pwSaving?'not-allowed':'pointer'}}>
                      {pwSaving ? 'Saving…' : 'Update Password'}
                    </button>
                  </div>
                </>
            }
          </div>
        </div>
      )}

      {/* VIEW AS BANNER */}
      {viewAs && (
        <div style={{background:'#92400e',color:'white',padding:'7px 20px',display:'flex',alignItems:'center',gap:10,fontSize:12,flexShrink:0}}>
          <span style={{fontSize:14}}>👁</span>
          <span><strong>Viewing as {viewAs}</strong> — showing tasks assigned to this person only</span>
          <button onClick={()=>setViewAs('')}
            style={{marginLeft:'auto',background:'rgba(255,255,255,0.2)',color:'white',border:'none',borderRadius:4,padding:'3px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>
            Exit View
          </button>
        </div>
      )}

      {/* MAIN TABS — Active / Pending My Review / Resolved */}
      <div style={{background:'white',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',padding:'0 20px',gap:4,flexShrink:0}}>
        {([
          { key:'active',         label:'Active Tasks',       count: visibleTasks.filter(t=>t.status!=='resolved').length },
          ...(currentUser.role==='staff' ? [] : [
            { key:'pending-review', label:'Pending My Review', count: pendingMyReview.length },
          ]),
          { key:'resolved',       label:'Resolved',           count: resolvedTasks.length },
        ] as {key:typeof activeMainTab;label:string;count:number}[]).map(tab=>(
          <button key={tab.key} onClick={()=>setActiveMainTab(tab.key)}
            style={{border:'none',borderBottom:activeMainTab===tab.key?'2px solid #1a3a2a':'2px solid transparent',
              background:'transparent',padding:'10px 14px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,
              color:activeMainTab===tab.key?'#1a3a2a':'#6b7280',fontWeight:activeMainTab===tab.key?700:400,fontSize:12.5}}>
            {tab.label}
            <span style={{background:activeMainTab===tab.key?'#1a3a2a':'#f3f4f6',
              color:activeMainTab===tab.key?'white':'#9ca3af',
              fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:10}}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* COMPANY TAB BAR */}
      <div style={{background:'white',borderBottom:'2px solid #e5e7eb',display:'flex',alignItems:'stretch',overflowX:'auto',flexShrink:0,scrollbarWidth:'none'}}>
        {[{label:'ALL',key:''}, ...COMPANIES.map(c=>({label:c,key:c}))].map(({label,key})=>{
          const active = filterCompany===key
          const cnt = key==='' ? visibleTasks.length : (companyCounts[key]||0)
          return (
            <button key={key} onClick={()=>{setFilterCompany(key);setFilterSection('')}}
              style={{border:'none',borderBottom:active?'2px solid #1a3a2a':'2px solid transparent',
                background:'transparent',padding:'0 14px',height:40,cursor:'pointer',
                display:'flex',alignItems:'center',gap:5,whiteSpace:'nowrap',flexShrink:0,
                color:active?'#1a3a2a':'#6b7280',fontWeight:active?700:400,fontSize:12,marginBottom:-2}}>
              {label}
              <span style={{background:active?'#1a3a2a':'#f3f4f6',color:active?'white':'#9ca3af',
                fontSize:10,fontWeight:700,padding:'1px 6px',borderRadius:10,minWidth:18,textAlign:'center'}}>
                {cnt}
              </span>
            </button>
          )
        })}
      </div>

      {/* PENDING MY REVIEW TAB */}
      {activeMainTab === 'pending-review' && (
        <div style={{flex:1,overflow:'auto',padding:20}}>
          {pendingMyReview.length === 0 ? (
            <div style={{textAlign:'center',color:'#9ca3af',paddingTop:60,fontSize:13}}>
              No tasks awaiting your approval.
            </div>
          ) : pendingMyReview.map(task => (
            <div key={task.id} style={{background:'white',border:`1px solid ${BORDER[task.status]||'#e5e7eb'}`,borderLeft:`4px solid ${BORDER[task.status]||'#e5e7eb'}`,borderRadius:6,padding:16,marginBottom:10}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:5}}>
                    <span style={{fontSize:10,fontWeight:700,color:'#9ca3af'}}>{task.company}</span>
                    <span className={STATUS_PILL[task.status]}>{STATUS_LABELS[task.status]}</span>
                    {task.priority!=='medium' && <span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:8,background:PRIORITY_STYLE[task.priority]?.bg,color:PRIORITY_STYLE[task.priority]?.color,textTransform:'uppercase'}}>{PRIORITY_LABELS[task.priority]}</span>}
                  </div>
                  <div style={{fontWeight:600,fontSize:13,color:'#111',marginBottom:4}}>{task.particulars}</div>
                  <div style={{fontSize:11,color:'#6b7280',marginBottom:6}}>
                    Responsible: <strong>{task.responsible}</strong> · {task.section} · {task.date}
                  </div>
                  {task.task_updates?.[0] && (
                    <div style={{fontSize:11,color:'#374151',background:'#f9fafb',padding:'6px 10px',borderRadius:4}}>
                      <strong>{task.task_updates[0].date}:</strong> {task.task_updates[0].text}
                    </div>
                  )}
                  {task.hod_comment && (
                    <div style={{fontSize:11,color:'#374151',background:'#fdf4ff',border:'1px solid #e9d5ff',padding:'6px 10px',borderRadius:4,marginTop:6}}>
                      <strong style={{color:'#5b21b6'}}>HOD Note:</strong> {task.hod_comment}
                    </div>
                  )}
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:6,flexShrink:0}}>
                  {(currentUser.role==='manager') && (
                    <>
                      <button onClick={()=>approveTask(task)}
                        style={{background:'#15803d',color:'white',border:'none',borderRadius:5,padding:'7px 16px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                        ✓ Approve
                      </button>
                      <button onClick={()=>escalateToHK(task)}
                        style={{background:'white',color:'#9d174d',border:'1px solid #fce7f3',borderRadius:5,padding:'7px 16px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                        ↑ Escalate to HK
                      </button>
                    </>
                  )}
                  {(currentUser.role==='director'||currentUser.role==='admin') && (
                    <button onClick={()=>approveTask(task)}
                      style={{background:'#15803d',color:'white',border:'none',borderRadius:5,padding:'7px 16px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      ✓ Approve & Resolve
                    </button>
                  )}
                  <button onClick={()=>{setActiveTask(task);setActiveMainTab('active')}}
                    style={{background:'white',color:'#374151',border:'1px solid #d1d5db',borderRadius:5,padding:'7px 16px',fontSize:12,cursor:'pointer'}}>
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RESOLVED TAB */}
      {activeMainTab === 'resolved' && (
        <div style={{flex:1,overflow:'auto',padding:20}}>
          <div style={{marginBottom:12}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search resolved tasks…"
              style={{border:'1px solid #d1d5db',borderRadius:4,padding:'6px 10px',fontSize:13,width:280,outline:'none'}}/>
            <span style={{marginLeft:12,fontSize:12,color:'#9ca3af'}}>{resolvedTasks.filter(t=>!search||JSON.stringify(t).toLowerCase().includes(search.toLowerCase())).length} resolved</span>
          </div>
          {resolvedTasks.filter(t=>!search||JSON.stringify(t).toLowerCase().includes(search.toLowerCase())).map(task => (
            <div key={task.id} style={{background:'white',border:'1px solid #e5e7eb',borderLeft:'4px solid #15803d',borderRadius:6,padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:3}}>
                  <span style={{fontSize:10,fontWeight:700,color:'#9ca3af'}}>{task.company}</span>
                  <span className="pill pill-resolved">Resolved</span>
                </div>
                <div style={{fontWeight:600,fontSize:13,color:'#374151'}}>{task.particulars}</div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>{task.responsible} · {task.section} · {task.date}</div>
              </div>
              <button onClick={()=>{setActiveTask(task);setActiveMainTab('active')}}
                style={{background:'white',color:'#374151',border:'1px solid #d1d5db',borderRadius:4,padding:'5px 12px',fontSize:11,cursor:'pointer',flexShrink:0}}>
                View
              </button>
            </div>
          ))}
        </div>
      )}

      {/* BODY */}
      {activeMainTab === 'active' && <div style={{display:'flex',flex:1,overflow:'hidden'}}>

        {/* SIDEBAR */}
        <div style={{width:192,background:'white',borderRight:'1px solid #e5e7eb',overflowY:'auto',flexShrink:0,paddingTop:8}}>

          {/* Director Attention — admin/director only */}
          {perms.canHKComment && (
            <>
              <div style={{padding:'4px 14px 5px',fontSize:10,fontWeight:700,color:'#b5833a',letterSpacing:'0.7px',textTransform:'uppercase'}}>
                My Attention
              </div>
              {[
                {label:'Pending My Review',   val:'pending-review'   as const, count:dirAttention.pendingReview.length,   dot:'#1d4ed8', desc:'In-review — ready for sign-off'},
                {label:'Needs HK Comment',    val:'needs-comment'    as const, count:dirAttention.needsComment.length,    dot:'#b5833a', desc:'Open tasks with no comment yet'},
                {label:'Action Required',     val:'action-required'  as const, count:dirAttention.actionRequired.length,  dot:'#dc2626', desc:'Flagged for escalation'},
              ].map(item=>(
                <div key={item.val}
                  onClick={()=>{
                    setDirectorFilter(directorFilter===item.val ? '' : item.val)
                    setFilterStatus(''); setFilterSection('')
                  }}
                  title={item.desc}
                  style={{display:'flex',alignItems:'center',gap:8,padding:'7px 14px',cursor:'pointer',
                    background:directorFilter===item.val?'#fef9ee':'transparent',
                    borderLeft:directorFilter===item.val?'3px solid #b5833a':'3px solid transparent',
                    color:directorFilter===item.val?'#92400e':'#4b5563',
                    fontWeight:directorFilter===item.val?600:400,fontSize:12}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:item.dot,flexShrink:0,display:'inline-block'}}/>
                  <span style={{flex:1,lineHeight:1.3}}>{item.label}</span>
                  <span style={{background:directorFilter===item.val?'#b5833a':'#f3f4f6',
                    color:directorFilter===item.val?'white':item.count>0?'#374151':'#9ca3af',
                    fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:10,minWidth:18,textAlign:'center'}}>
                    {item.count}
                  </span>
                </div>
              ))}
              <div style={{height:1,background:'#f3f4f6',margin:'8px 12px'}}/>
            </>
          )}

          <div style={{padding:'4px 14px 5px',fontSize:10,fontWeight:700,color:'#9ca3af',letterSpacing:'0.7px',textTransform:'uppercase'}}>Status</div>
          {[
            {label:'All Tasks',          val:'',                  count:base.length},
            {label:'Action Required',    val:'action-required',   count:kpis.action},
            {label:'Pending Discussion', val:'pending-discussion', count:kpis.pending},
            {label:'In Review',          val:'in-review',         count:kpis.review},
            {label:'Resolved',           val:'resolved',          count:kpis.resolved},
          ].map(item=>(
            <div key={item.val} onClick={()=>{setFilterStatus(item.val);setDirectorFilter('')}}
              style={{display:'flex',alignItems:'center',gap:8,padding:'8px 14px',cursor:'pointer',
                background:!directorFilter && filterStatus===item.val?'#f0fdf4':'transparent',
                borderLeft:!directorFilter && filterStatus===item.val?'3px solid #1a3a2a':'3px solid transparent',
                color:!directorFilter && filterStatus===item.val?'#1a3a2a':'#4b5563',
                fontWeight:!directorFilter && filterStatus===item.val?600:400,fontSize:12.5}}>
              <span style={{flex:1}}>{item.label}</span>
              <span style={{background:!directorFilter && filterStatus===item.val?'#1a3a2a':'#f3f4f6',
                color:!directorFilter && filterStatus===item.val?'white':'#9ca3af',
                fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:10}}>
                {item.count}
              </span>
            </div>
          ))}

          {availableSections.length>0 && !directorFilter && <>
            <div style={{height:1,background:'#f3f4f6',margin:'8px 12px'}}/>
            <div style={{padding:'6px 14px 4px',fontSize:10,fontWeight:700,color:'#9ca3af',letterSpacing:'0.7px',textTransform:'uppercase'}}>Sections</div>
            {[{label:'All Sections',val:''}, ...availableSections.map(s=>({label:s,val:s}))].map(item=>(
              <div key={item.val} onClick={()=>setFilterSection(item.val)}
                style={{padding:'6px 14px',cursor:'pointer',fontSize:11.5,lineHeight:1.35,
                  color:filterSection===item.val?'#1a3a2a':'#4b5563',
                  fontWeight:filterSection===item.val?600:400,
                  background:filterSection===item.val?'#f0fdf4':'transparent',
                  borderLeft:filterSection===item.val?'3px solid #1a3a2a':'3px solid transparent'}}>
                {item.label||'All Sections'}
              </div>
            ))}
          </>}
        </div>

        {/* MAIN */}
        <div style={{flex:1,overflowY:'auto',padding:'15px 17px',background:'#f9fafb'}}>

          {/* KPI strip */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:13}}>
            {[
              {label:'Total',           val:kpis.total,    col:'#1e40af'},
              {label:'Action Required', val:kpis.action,   col:'#b91c1c'},
              {label:'Pending',         val:kpis.pending,  col:'#b45309'},
              {label:'In Review',       val:kpis.review,   col:'#1d4ed8'},
              {label:'Resolved',        val:kpis.resolved, col:'#15803d'},
            ].map(k=>(
              <div key={k.label} style={{background:'white',border:'1px solid #e5e7eb',borderRadius:6,padding:'10px 13px'}}>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.5px',color:'#9ca3af',fontWeight:600}}>{k.label}</div>
                <div style={{fontSize:26,fontWeight:800,color:k.col,lineHeight:1.1,marginTop:2}}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Filter bar */}
          <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:6,padding:'9px 13px',display:'flex',gap:8,alignItems:'center',marginBottom:12,flexWrap:'wrap'}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tasks…"
              style={{border:'1px solid #d1d5db',borderRadius:4,padding:'5px 9px',fontSize:12,width:180,outline:'none'}}/>
            <select value={filterSection} onChange={e=>setFilterSection(e.target.value)}
              style={{border:'1px solid #d1d5db',borderRadius:4,padding:'5px 8px',fontSize:12,color:'#374151',maxWidth:175}}>
              <option value="">All Sections</option>
              {availableSections.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filterPriority} onChange={e=>setFilterPriority(e.target.value)}
              style={{border:'1px solid #d1d5db',borderRadius:4,padding:'5px 8px',fontSize:12,color:'#374151'}}>
              <option value="">All Priorities</option>
              {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([k,v])=>(
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            {effectiveRole !== 'staff' && (
              <select value={filterPerson} onChange={e=>setFilterPerson(e.target.value)}
                style={{border:'1px solid #d1d5db',borderRadius:4,padding:'5px 8px',fontSize:12,color:'#374151'}}>
                <option value="">All People</option>
                {availablePeople.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            )}
            <button onClick={()=>{setSearch('');setFilterSection('');setFilterStatus('');setFilterPriority('');setFilterPerson('')}}
              style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'5px 10px',fontSize:12,cursor:'pointer',color:'#4b5563'}}>
              Reset
            </button>
            <div style={{flex:1}}/>
            <span style={{fontSize:11,color:'#9ca3af'}}>{filtered.length} task{filtered.length!==1?'s':''}</span>
            <button onClick={handlePrint}
              style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'5px 12px',fontSize:12,cursor:'pointer',color:'#374151',display:'flex',alignItems:'center',gap:5}}>
              🖨 Print / PDF
            </button>
          </div>

          {/* Add task form */}
          {showAddForm && perms.canAddTask && (
            <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:6,padding:'14px 16px',marginBottom:12}}>
              <div style={{fontWeight:700,fontSize:13.5,marginBottom:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                New Task
                <button onClick={()=>setShowAddForm(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:'#9ca3af'}}>✕</button>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10,marginBottom:10}}>
                {([
                  {label:'Company',    key:'company',    opts:[...COMPANIES]},
                  {label:'Section',    key:'section',    opts:[...SECTIONS]},
                  {label:'Date',       key:'date',       opts:null},
                  {label:'Category',   key:'category',   opts:[...CATEGORIES]},
                  {label:'Responsible',key:'responsible',opts:[...PEOPLE]},
                  {label:'Payment',    key:'payment',    opts:['Non-Payment','Payment']},
                  {label:'Status',     key:'status',     opts:Object.keys(STATUS_LABELS)},
                  {label:'Priority',   key:'priority',   opts:Object.keys(PRIORITY_LABELS)},
                ] as {label:string;key:string;opts:string[]|null}[]).map(f=>(
                  <div key={f.key}>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>{f.label}</label>
                    {f.opts
                      ? <select value={(form as any)[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
                          style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'6px 7px',fontSize:12}}>
                          {f.opts.map(o=><option key={o} value={o}>{STATUS_LABELS[o as TaskStatus]||PRIORITY_LABELS[o as TaskPriority]||o}</option>)}
                        </select>
                      : <input value={(form as any)[f.key]} onChange={e=>setForm(v=>({...v,[f.key]:e.target.value}))}
                          style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'6px 7px',fontSize:12}}/>
                    }
                  </div>
                ))}
                <div style={{gridColumn:'1/-1'}}>
                  <label style={{display:'block',fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>Particulars</label>
                  <input value={form.particulars} onChange={e=>setForm(v=>({...v,particulars:e.target.value}))} placeholder="Task description…"
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'6px 7px',fontSize:12}}/>
                </div>
                <div style={{gridColumn:'1/-1'}}>
                  <label style={{display:'block',fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>Initial Update</label>
                  <textarea value={form.initial_update} onChange={e=>setForm(v=>({...v,initial_update:e.target.value}))}
                    rows={2} placeholder="Background, context, requirements…"
                    style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'6px 7px',fontSize:12,resize:'vertical',fontFamily:'inherit'}}/>
                </div>
                {perms.canHKComment && (
                  <div style={{gridColumn:'3/-1'}}>
                    <label style={{display:'block',fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:3}}>HK Comment</label>
                    <input value={form.hk_comment} onChange={e=>setForm(v=>({...v,hk_comment:e.target.value}))}
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'6px 7px',fontSize:12}}/>
                  </div>
                )}
              </div>
              <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
                <button onClick={()=>setShowAddForm(false)} style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'6px 14px',fontSize:12,cursor:'pointer'}}>Cancel</button>
                <button onClick={addTask} disabled={saving||!form.particulars.trim()}
                  style={{background:'#1a3a2a',color:'white',border:'none',borderRadius:4,padding:'6px 16px',fontSize:12,fontWeight:600,cursor:'pointer',opacity:form.particulars.trim()?1:0.5}}>
                  {saving?'Saving…':'+ Add Task'}
                </button>
              </div>
            </div>
          )}

          {/* Task table */}
          <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:6,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:showCompanyCol?'38px 72px 88px 108px 96px 155px 1fr 115px 112px 60px':'38px 72px 108px 96px 165px 1fr 115px 112px 60px',background:'#f9fafb',borderBottom:'1px solid #e5e7eb',padding:'0 6px'}}>
              {(showCompanyCol
                ? ['#','Date','Company','Section','Category','Particulars','Latest Update','Responsible','Status','']
                : ['#','Date','Section','Category','Particulars','Latest Update','Responsible','Status','']
              ).map(h=>(
                <div key={h} style={{padding:'8px 6px',fontSize:10,fontWeight:700,color:'#9ca3af',letterSpacing:'0.5px',textTransform:'uppercase'}}>{h}</div>
              ))}
            </div>

            {filtered.length===0 && (
              <div style={{padding:48,textAlign:'center',color:'#9ca3af',fontSize:13}}>
                {effectiveRole==='staff' && !viewAs
                  ? `No tasks assigned to ${currentUser.name}`
                  : 'No tasks match your filters'}
              </div>
            )}

            {filtered.map(task=>{
              const appUpdates   = task.task_updates ?? []
              const parsedUpds   = parseUpdates(task.updates)
              // latest = newest app update, else last parsed entry (chronologically last = end of string)
              const latestApp    = appUpdates[0]
              const latestParsed = parsedUpds.length ? parsedUpds[parsedUpds.length - 1] : null
              const isExp        = expandedRows.has(task.id)
              return (
                <div key={task.id}>
                  <div onClick={()=>setActiveTask(activeTask?.id===task.id?null:task)}
                    style={{display:'grid',gridTemplateColumns:showCompanyCol?'38px 72px 88px 108px 96px 155px 1fr 115px 112px 60px':'38px 72px 108px 96px 165px 1fr 115px 112px 60px',
                      borderBottom:'1px solid #f3f4f6',padding:'0 6px',cursor:'pointer',
                      borderLeft:`3px solid ${BORDER[task.status]}`,
                      background:activeTask?.id===task.id?'#f8faff':'white'}}>
                    <div style={{padding:'9px 6px',fontSize:11,color:'#9ca3af',fontWeight:700}}>{task.sno}</div>
                    <div style={{padding:'9px 6px',fontSize:11,color:'#6b7280'}}>{task.date}</div>
                    {showCompanyCol && (
                      <div style={{padding:'9px 6px'}}>
                        <span style={{background:'#eff6ff',border:'1px solid #bfdbfe',padding:'2px 6px',borderRadius:8,fontSize:9,fontWeight:700,color:'#1d4ed8',display:'inline-block',lineHeight:1.4}}>{task.company}</span>
                      </div>
                    )}
                    <div style={{padding:'9px 6px'}}>
                      <span style={{background:'#f0fdf4',border:'1px solid #bbf7d0',padding:'2px 6px',borderRadius:8,fontSize:9.5,fontWeight:600,color:'#166534',display:'inline-block',lineHeight:1.4}}>
                        {sectionShort(task.section)}
                      </span>
                    </div>
                    <div style={{padding:'9px 6px'}}>
                      <span style={{background:'#f9fafb',border:'1px solid #e5e7eb',padding:'2px 7px',borderRadius:10,fontSize:10,color:'#4b5563'}}>{task.category}</span>
                    </div>
                    <div style={{padding:'9px 6px',fontSize:12,fontWeight:600,color:'#111827',lineHeight:1.35}}>{task.particulars}</div>
                    <div style={{padding:'9px 6px',fontSize:11,color:'#4b5563',lineHeight:1.4}}>
                      {latestApp
                        ? <><strong style={{color:'#111827'}}>{latestApp.date}:</strong>{' '}{latestApp.text.slice(0,80)}{latestApp.text.length>80?'…':''}</>
                        : latestParsed
                          ? <>
                              {latestParsed.label && <strong style={{color:latestParsed.isHK?'#b5833a':'#111827'}}>{latestParsed.label}:{' '}</strong>}
                              {latestParsed.text.slice(0,80)}{latestParsed.text.length>80?'…':''}
                            </>
                          : task.updates
                            ? <span>{task.updates.slice(0,80)}{task.updates.length>80?'…':''}</span>
                            : <em style={{color:'#9ca3af'}}>No updates</em>}
                    </div>
                    <div style={{padding:'9px 6px',display:'flex',alignItems:'center',gap:5}}>
                      <div style={{width:22,height:22,borderRadius:'50%',background:avatarColor(task.responsible),color:'white',fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {avatarInitials(task.responsible)}
                      </div>
                      <span style={{fontSize:10.5,color:'#374151'}}>{task.responsible}</span>
                    </div>
                    <div style={{padding:'9px 6px',display:'flex',flexDirection:'column',gap:4}}>
                      <span className={STATUS_PILL[task.status]}>{STATUS_LABELS[task.status]}</span>
                      {task.priority && task.priority !== 'medium' && (
                        <span style={{display:'inline-block',fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:8,
                          background:PRIORITY_STYLE[task.priority]?.bg, color:PRIORITY_STYLE[task.priority]?.color,
                          textTransform:'uppercase',letterSpacing:'0.5px',alignSelf:'flex-start'}}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      )}
                    </div>
                    <div style={{padding:'9px 6px',display:'flex',gap:3,alignItems:'center'}}>
                      <button onClick={e=>{e.stopPropagation();toggleRow(task.id)}}
                        style={{width:25,height:25,borderRadius:4,border:'1px solid #e5e7eb',background:'white',cursor:'pointer',fontSize:11,color:'#9ca3af'}} title="History">
                        {isExp?'▲':'▼'}
                      </button>
                      {perms.canDelete && (
                        <button onClick={e=>{e.stopPropagation();deleteTask(task.id)}}
                          style={{width:25,height:25,borderRadius:4,border:'1px solid #fee2e2',background:'white',cursor:'pointer',fontSize:11,color:'#dc2626'}} title="Delete">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded history */}
                  {isExp && (
                    <div style={{background:'#f8faf8',borderBottom:'1px solid #e5e7eb',padding:'11px 18px 13px 50px'}}>
                      <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:'#9ca3af',marginBottom:7}}>Full Update History</div>
                      <div style={{borderLeft:'2px solid #d1d5db',paddingLeft:13,display:'flex',flexDirection:'column',gap:8}}>
                        {/* App-added updates first (newest) */}
                        {(appUpdates).map((u)=>(
                          <div key={u.id} style={{position:'relative'}}>
                            <div style={{position:'absolute',left:-18,top:4,width:8,height:8,borderRadius:'50%',background:'#1a3a2a',border:'2px solid white',outline:'2px solid #1a3a2a'}}/>
                            <div style={{fontSize:9.5,fontWeight:700,color:'#2d6a4f',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:1}}>{u.date}</div>
                            <div style={{fontSize:12,color:'#374151',lineHeight:1.45}}>{u.text}</div>
                          </div>
                        ))}
                        {/* Parsed original updates string (oldest first) */}
                        {parsedUpds.length === 0 && task.updates?.trim() && (
                          <div style={{position:'relative'}}>
                            <div style={{position:'absolute',left:-18,top:4,width:8,height:8,borderRadius:'50%',background:'#9ca3af',border:'2px solid white',outline:'2px solid #9ca3af'}}/>
                            <div style={{fontSize:12,color:'#374151',lineHeight:1.45}}>{task.updates}</div>
                          </div>
                        )}
                        {[...parsedUpds].reverse().map((e,i)=>(
                          <div key={i} style={{position:'relative'}}>
                            <div style={{position:'absolute',left:-18,top:4,width:8,height:8,borderRadius:'50%',background:e.isHK?'#b5833a':'#9ca3af',border:'2px solid white',outline:`2px solid ${e.isHK?'#b5833a':'#9ca3af'}`}}/>
                            {e.label && <div style={{fontSize:9.5,fontWeight:700,color:e.isHK?'#b5833a':'#2d6a4f',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:1}}>{e.label}</div>}
                            <div style={{fontSize:12,color:'#374151',lineHeight:1.45}}>{e.text}</div>
                          </div>
                        ))}
                        {appUpdates.length===0 && parsedUpds.length===0 && !task.updates?.trim() && (
                          <div style={{fontSize:12,color:'#9ca3af',fontStyle:'italic'}}>No updates recorded</div>
                        )}
                      </div>
                      {task.hk_comment && (
                        <div style={{background:'#fef9ee',border:'1px solid #e8c97a',borderRadius:5,padding:'8px 11px',marginTop:10,fontSize:12,color:'#4b5563'}}>
                          <strong style={{color:'#b5833a',fontSize:9.5,textTransform:'uppercase',display:'block',marginBottom:2}}>HK Comment</strong>
                          {task.hk_comment}
                        </div>
                      )}
                      {task.status_wk && (
                        <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:5,padding:'8px 11px',marginTop:5,fontSize:12,color:'#1e40af'}}>
                          <strong style={{fontSize:9.5,textTransform:'uppercase',display:'block',marginBottom:2}}>Status {weekNum()}</strong>
                          {task.status_wk}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* DETAIL PANEL */}
        {activeTask && (
          <div style={{width:325,borderLeft:'1px solid #e5e7eb',background:'white',overflowY:'auto',flexShrink:0,display:'flex',flexDirection:'column'}}>
            <div style={{padding:'12px 14px',background:'#1a3a2a',color:'white',flexShrink:0}}>
              <button onClick={()=>setActiveTask(null)} style={{float:'right',background:'none',border:'none',color:'rgba(255,255,255,0.5)',cursor:'pointer',fontSize:16,lineHeight:1}}>✕</button>
              <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px',color:'rgba(255,255,255,0.5)',marginBottom:3}}>
                {activeTask.company} · {activeTask.section}
              </div>
              <div style={{fontSize:13,fontWeight:700,lineHeight:1.35}}>{activeTask.particulars}</div>
            </div>

            <div style={{padding:'12px 14px',flex:1,overflowY:'auto'}}>
              {[
                {l:'Date',        v:activeTask.date},
                {l:'Responsible', v:activeTask.responsible},
                {l:'Payment',     v:activeTask.payment},
                {l:'Category',    v:activeTask.category},
              ].map(r=>(
                <div key={r.l} style={{display:'flex',gap:8,marginBottom:8,alignItems:'flex-start'}}>
                  <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.4px',width:82,flexShrink:0,paddingTop:1}}>{r.l}</div>
                  <div style={{fontSize:12,color:'#111827'}}>{r.v}</div>
                </div>
              ))}

              {/* Status — read-only for staff */}
              <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.4px',width:82,flexShrink:0}}>Status</div>
                {perms.canChangeStatus
                  ? <select value={activeTask.status} onChange={e=>changeStatus(activeTask,e.target.value as TaskStatus)}
                      style={{flex:1,border:'1px solid #d1d5db',borderRadius:4,padding:'4px 6px',fontSize:11}}>
                      {STATUS_OPTIONS_BY_ROLE[currentUser.role].map(k=><option key={k} value={k}>{STATUS_LABELS[k]}</option>)}
                    </select>
                  : <span className={STATUS_PILL[activeTask.status]}>{STATUS_LABELS[activeTask.status]}</span>
                }
              </div>

              {/* Priority */}
              <div style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.4px',width:82,flexShrink:0}}>Priority</div>
                {perms.canChangeStatus
                  ? <select value={activeTask.priority||'medium'} onChange={async e=>{
                        const res = await fetch(`/api/tasks/${activeTask.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({priority:e.target.value})})
                        if(res.ok){const updated=await res.json();setTasks(ts=>ts.map(t=>t.id===updated.id?updated:t))}
                      }}
                      style={{flex:1,border:'1px solid #d1d5db',borderRadius:4,padding:'4px 6px',fontSize:11}}>
                      {(Object.entries(PRIORITY_LABELS) as [TaskPriority, string][]).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                    </select>
                  : <span style={{fontSize:11,fontWeight:600,padding:'2px 8px',borderRadius:8,
                      background:PRIORITY_STYLE[activeTask.priority||'medium']?.bg,
                      color:PRIORITY_STYLE[activeTask.priority||'medium']?.color}}>
                      {PRIORITY_LABELS[activeTask.priority||'medium']}
                    </span>
                }
              </div>

              {/* Status WK — editable */}
              <>
                <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.5px',margin:'12px 0 5px',paddingBottom:4,borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  Status {weekNum()}
                  {perms.canPostUpdate(activeTask) && swkEditId !== activeTask.id && (
                    <button onClick={()=>{setSwkEditId(activeTask.id);setSwkDraft(activeTask.status_wk||'')}}
                      style={{fontSize:9.5,color:'#1d4ed8',cursor:'pointer',border:'none',background:'none',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>
                      Edit
                    </button>
                  )}
                </div>
                {swkEditId === activeTask.id
                  ? <div>
                      <textarea value={swkDraft} onChange={e=>setSwkDraft(e.target.value)} rows={3}
                        placeholder="Enter this week's status update…"
                        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'7px 8px',fontSize:12,resize:'none',fontFamily:'inherit',marginBottom:5}}/>
                      <div style={{display:'flex',gap:5,justifyContent:'flex-end'}}>
                        <button onClick={()=>{setSwkEditId(null);setSwkDraft('')}}
                          style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>Cancel</button>
                        <button onClick={()=>saveStatusWk(activeTask.id,swkDraft)}
                          style={{background:'#1d4ed8',color:'white',border:'none',borderRadius:4,padding:'4px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Save</button>
                      </div>
                    </div>
                  : <div style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:5,padding:'8px 11px',fontSize:12,color:activeTask.status_wk?'#1e40af':'#9ca3af',minHeight:34,lineHeight:1.45}}>
                      {activeTask.status_wk || 'No status update yet — click Edit to add one.'}
                    </div>
                }
              </>

              {/* HK Comment — editable for admin/director */}
              <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.5px',margin:'12px 0 5px',paddingBottom:4,borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                HK Comment
                {perms.canHKComment && hkEditId!==activeTask.id && (
                  <button onClick={()=>{setHkEditId(activeTask.id);setHkDraft(activeTask.hk_comment||'')}}
                    style={{fontSize:9.5,color:'#b5833a',cursor:'pointer',border:'none',background:'none',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>
                    Edit
                  </button>
                )}
              </div>
              {perms.canHKComment && hkEditId===activeTask.id
                ? <div>
                    <textarea value={hkDraft} onChange={e=>setHkDraft(e.target.value)} rows={3}
                      placeholder="Enter HK comment…"
                      style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'7px 8px',fontSize:12,resize:'none',fontFamily:'inherit',marginBottom:5}}/>
                    <div style={{display:'flex',gap:5,justifyContent:'flex-end'}}>
                      <button onClick={()=>{setHkEditId(null);setHkDraft('')}}
                        style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>Cancel</button>
                      <button onClick={()=>saveHKComment(activeTask.id,hkDraft)}
                        style={{background:'#b5833a',color:'white',border:'none',borderRadius:4,padding:'4px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Save</button>
                    </div>
                  </div>
                : <div style={{background:'#fef9ee',border:'1px solid #e8c97a',borderRadius:5,padding:'8px 11px',fontSize:12,color:activeTask.hk_comment?'#4b5563':'#9ca3af',minHeight:34}}>
                    {activeTask.hk_comment || (perms.canHKComment ? 'No comment — click Edit to add one.' : '—')}
                  </div>
              }

              {/* HOD Comment — editable for managers (and director/admin) */}
              {(currentUser.role === 'manager' || currentUser.role === 'director' || currentUser.role === 'admin') && (
                <>
                  <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.5px',margin:'12px 0 5px',paddingBottom:4,borderBottom:'1px solid #f3f4f6',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    HOD Comment
                    {hodEditId !== activeTask.id && (
                      <button onClick={()=>{setHodEditId(activeTask.id);setHodDraft(activeTask.hod_comment||'')}}
                        style={{fontSize:9.5,color:'#5b21b6',cursor:'pointer',border:'none',background:'none',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>
                        Edit
                      </button>
                    )}
                  </div>
                  {hodEditId === activeTask.id
                    ? <div>
                        <textarea value={hodDraft} onChange={e=>setHodDraft(e.target.value)} rows={3}
                          placeholder="Enter HOD comment…"
                          style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'7px 8px',fontSize:12,resize:'none',fontFamily:'inherit',marginBottom:5}}/>
                        <div style={{display:'flex',gap:5,justifyContent:'flex-end'}}>
                          <button onClick={()=>{setHodEditId(null);setHodDraft('')}}
                            style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>Cancel</button>
                          <button onClick={()=>saveHODComment(activeTask.id,hodDraft)}
                            style={{background:'#5b21b6',color:'white',border:'none',borderRadius:4,padding:'4px 12px',fontSize:11,fontWeight:600,cursor:'pointer'}}>Save</button>
                        </div>
                      </div>
                    : <div style={{background:'#fdf4ff',border:'1px solid #e9d5ff',borderRadius:5,padding:'8px 11px',fontSize:12,color:activeTask.hod_comment?'#374151':'#9ca3af',minHeight:34}}>
                        {activeTask.hod_comment || 'No HOD comment yet — click Edit to add one.'}
                      </div>
                  }
                  {/* Approval buttons when task is awaiting HOD approval */}
                  {activeTask.status === 'awaiting-hod-approval' && currentUser.role === 'manager' &&
                    subordinates.some(s => nameMatch(activeTask.responsible, s)) && (
                    <div style={{display:'flex',gap:6,marginTop:10}}>
                      <button onClick={()=>approveTask(activeTask)}
                        style={{flex:1,background:'#15803d',color:'white',border:'none',borderRadius:4,padding:'7px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                        ✓ Approve & Resolve
                      </button>
                      <button onClick={()=>escalateToHK(activeTask)}
                        style={{flex:1,background:'white',color:'#9d174d',border:'1px solid #fce7f3',borderRadius:4,padding:'7px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                        ↑ Escalate to HK
                      </button>
                    </div>
                  )}
                  {/* HK approval button */}
                  {activeTask.status === 'awaiting-hk-approval' && (currentUser.role === 'director' || currentUser.role === 'admin') && (
                    <button onClick={()=>approveTask(activeTask)}
                      style={{width:'100%',marginTop:10,background:'#15803d',color:'white',border:'none',borderRadius:4,padding:'8px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                      ✓ Approve & Resolve
                    </button>
                  )}
                </>
              )}

              {/* Update history */}
              {(() => {
                const panelAppUpds    = activeTask.task_updates ?? []
                const panelParsed     = parseUpdates(activeTask.updates)
                const totalCount      = panelAppUpds.length + panelParsed.length
                return (
                  <>
                    <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.5px',margin:'12px 0 5px',paddingBottom:4,borderBottom:'1px solid #f3f4f6'}}>
                      Update History ({totalCount})
                    </div>
                    <div style={{borderLeft:'2px solid #d1d5db',paddingLeft:13,display:'flex',flexDirection:'column',gap:10}}>
                      {/* App-added updates (newest first) */}
                      {panelAppUpds.map((u)=>(
                        <div key={u.id} style={{position:'relative'}}>
                          <div style={{position:'absolute',left:-17,top:4,width:8,height:8,borderRadius:'50%',background:'#1a3a2a',border:'2px solid white',outline:'2px solid #1a3a2a'}}/>
                          <div style={{fontSize:9.5,fontWeight:700,color:'#2d6a4f',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:2}}>{u.date}</div>
                          <div style={{fontSize:12,color:'#374151',lineHeight:1.45}}>{u.text}</div>
                        </div>
                      ))}
                      {/* Original updates string — no date pattern, show raw */}
                      {panelParsed.length === 0 && activeTask.updates?.trim() && (
                        <div style={{position:'relative'}}>
                          <div style={{position:'absolute',left:-17,top:4,width:8,height:8,borderRadius:'50%',background:'#9ca3af',border:'2px solid white',outline:'2px solid #9ca3af'}}/>
                          <div style={{fontSize:12,color:'#374151',lineHeight:1.5}}>{activeTask.updates}</div>
                        </div>
                      )}
                      {/* Original updates string — parsed into timeline (newest first = reversed) */}
                      {[...panelParsed].reverse().map((e,i)=>(
                        <div key={i} style={{position:'relative'}}>
                          <div style={{position:'absolute',left:-17,top:4,width:8,height:8,borderRadius:'50%',background:e.isHK?'#b5833a':'#9ca3af',border:'2px solid white',outline:`2px solid ${e.isHK?'#b5833a':'#9ca3af'}`}}/>
                          {e.label && (
                            <div style={{fontSize:9.5,fontWeight:700,color:e.isHK?'#b5833a':'#2d6a4f',textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:2}}>
                              {e.isHK ? 'HK Comment' : e.label}
                            </div>
                          )}
                          <div style={{fontSize:12,color:e.isHK?'#92400e':'#374151',lineHeight:1.5,background:e.isHK?'#fef9ee':undefined,padding:e.isHK?'5px 8px':undefined,borderRadius:e.isHK?4:undefined}}>
                            {e.text}
                          </div>
                        </div>
                      ))}
                      {panelAppUpds.length===0 && panelParsed.length===0 && !activeTask.updates?.trim() && (
                        <div style={{fontSize:12,color:'#9ca3af',fontStyle:'italic'}}>No updates recorded</div>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>

            {/* Add Update — shown only if user can post on this task */}
            {perms.canPostUpdate(activeTask) && (
              <div style={{padding:'9px 12px',borderTop:'1px solid #f3f4f6',background:'#f9fafb',flexShrink:0}}>
                <div style={{fontSize:9.5,fontWeight:700,textTransform:'uppercase',color:'#9ca3af',letterSpacing:'0.4px',marginBottom:5}}>Add Update</div>
                <textarea value={comment} onChange={e=>setComment(e.target.value)}
                  rows={3} placeholder="Add a progress note…"
                  style={{width:'100%',border:'1px solid #d1d5db',borderRadius:4,padding:'7px 8px',fontSize:12,resize:'none',fontFamily:'inherit',marginBottom:6}}/>
                <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                  <button onClick={()=>setActiveTask(null)} style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'5px 12px',fontSize:11,cursor:'pointer'}}>Close</button>
                  <button onClick={postUpdate} disabled={saving||!comment.trim()}
                    style={{background:'#1a3a2a',color:'white',border:'none',borderRadius:4,padding:'5px 14px',fontSize:11,fontWeight:600,cursor:'pointer',opacity:comment.trim()?1:0.5}}>
                    {saving?'Posting…':'Post Update'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>}

      {/* STATUS BAR */}
      <div style={{background:'#1a3a2a',color:'rgba(255,255,255,0.55)',fontSize:10.5,padding:'5px 20px',display:'flex',gap:14,alignItems:'center',flexShrink:0}}>
        <span style={{color:'rgba(255,255,255,0.85)',fontWeight:600}}>PABARI GROUP</span>
        <span>·</span>
        <span style={{color:'rgba(255,255,255,0.75)'}}>
          {viewAs ? `Viewing as ${viewAs}` : filterCompany || 'ALL COMPANIES'}
        </span>
        <span>·</span>
        <span>{currentUser.name} ({currentUser.role})</span>
        <span>·</span>
        <span>{weekNum()}</span>
        <span>·</span>
        <span>{new Date().toISOString().slice(0,10)}</span>
        <div style={{flex:1}}/>
        <span style={{color:'rgba(255,255,255,0.3)'}}>{filtered.length} shown</span>
      </div>

    </div>
  )
}
