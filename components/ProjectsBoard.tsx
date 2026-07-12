'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Project, Milestone, ProjectStatus, SessionUser,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE, COMPANIES, PEOPLE,
} from '@/types'
import type { ProjectNote } from '@/lib/projects'

const AVATAR_COLORS: Record<string, string> = {
  harshil:'#b5833a', sabina:'#6c5ce7', ahmad:'#e17055', ashok:'#0984e3',
  paul:'#2d6a4f', krishnan:'#00b894', yalelet:'#fd79a8', suresh:'#5f27cd',
  benson:'#00cec9', andu:'#d63031', yared:'#e84393', simon:'#74b9ff',
}
function avatarColor(name: string) { return AVATAR_COLORS[name.toLowerCase().split(/[\s&./]+/)[0]] || '#2d6a4f' }
function avatarInitials(name: string) { return name.split(/[\s&./]+/).map(w=>w[0]).filter(Boolean).join('').toUpperCase().slice(0,2) }
function fmtDate(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}
function daysLeft(d: string): number {
  if (!d) return Infinity
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((new Date(d+'T00:00:00').getTime() - today.getTime()) / 86400000)
}
function progressPct(done: number, total: number) { return total === 0 ? 0 : Math.round((done / total) * 100) }

interface Props { initialProjects: Project[]; currentUser: SessionUser }

const BLANK_FORM = {
  name:'', description:'', company:'BYTEWISE', owner:'',
  status:'active' as ProjectStatus, start_date:'', end_date:'', budget:'',
}

export default function ProjectsBoard({ initialProjects, currentUser }: Props) {
  const [projects, setProjects]       = useState<Project[]>(initialProjects)
  const [active,   setActive]         = useState<Project | null>(null)
  const [tasks,    setTasks]          = useState<Record<string,unknown>[]>([])
  const [filterStatus, setFilterStatus] = useState<ProjectStatus | ''>('')
  const [filterCompany, setFilterCompany] = useState('')
  const [showForm, setShowForm]       = useState(false)
  const [form,     setForm]           = useState({ ...BLANK_FORM, owner: currentUser.name })
  const [saving,   setSaving]         = useState(false)
  const [detailTab, setDetailTab]     = useState<'overview'|'thread'|'gantt'>('overview')

  // Milestone state
  const [msTitle,  setMsTitle]  = useState('')
  const [msDate,   setMsDate]   = useState('')
  const [msAdding, setMsAdding] = useState(false)

  // Edit project
  const [showEdit,   setShowEdit]   = useState(false)
  const [editForm,   setEditForm]   = useState({ ...BLANK_FORM, owner: currentUser.name })
  const [editSaving, setEditSaving] = useState(false)

  // Link tasks
  const [allTasks,     setAllTasks]     = useState<Record<string,unknown>[]>([])
  const [showLinkTask, setShowLinkTask] = useState(false)
  const [linkSearch,   setLinkSearch]   = useState('')
  const [linkLoading,  setLinkLoading]  = useState(false)

  // Thread (project notes) state
  const [notes,     setNotes]     = useState<ProjectNote[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving,setNoteSaving]= useState(false)
  const threadBottomRef = useRef<HTMLDivElement>(null)

  const canEdit = currentUser.role !== 'staff'
  const canDelete = currentUser.role === 'admin' || currentUser.role === 'director'
  const canChangeStatus = active
    ? (currentUser.role === 'admin' || currentUser.role === 'director' || currentUser.name === active.owner)
    : false

  const filtered = useMemo(() => projects.filter(p => {
    if (filterStatus  && p.status  !== filterStatus)  return false
    if (filterCompany && p.company !== filterCompany) return false
    return true
  }), [projects, filterStatus, filterCompany])

  async function openProject(p: Project) {
    setActive(p)
    setDetailTab('overview')
    setNotes([])
    const [res, notesRes] = await Promise.all([
      fetch(`/api/projects/${p.id}`, { credentials: 'include' }),
      fetch(`/api/projects/${p.id}/notes`, { credentials: 'include' }),
    ])
    if (res.ok) {
      const data = await res.json()
      setActive(data.project)
      setTasks(data.tasks || [])
      setProjects(prev => prev.map(x => x.id === data.project.id ? data.project : x))
    }
    if (notesRes.ok) {
      const notesData = await notesRes.json()
      setNotes(Array.isArray(notesData) ? notesData : [])
    }
  }

  async function postNote() {
    if (!noteDraft.trim() || !active) return
    setNoteSaving(true)
    const res = await fetch(`/api/projects/${active.id}/notes`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ message: noteDraft.trim() }),
    })
    if (res.ok) {
      const note: ProjectNote = await res.json()
      setNotes(prev => [...prev, note])
      setNoteDraft('')
      setTimeout(() => threadBottomRef.current?.scrollIntoView({ behavior:'smooth' }), 50)
    }
    setNoteSaving(false)
  }

  async function deleteNote(noteId: number) {
    if (!active) return
    await fetch(`/api/projects/${active.id}/notes`, {
      method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ note_id: noteId }),
    })
    setNotes(prev => prev.filter(n => n.id !== noteId))
  }

  async function createProject() {
    if (!form.name.trim()) return
    setSaving(true)
    const res = await fetch('/api/projects', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ ...form, budget: Number(form.budget) || 0 }),
    })
    if (res.ok) {
      const p = await res.json()
      setProjects(prev => [p, ...prev])
      setShowForm(false)
      setForm({ ...BLANK_FORM, owner: currentUser.name })
    }
    setSaving(false)
  }

  async function updateStatus(p: Project, status: ProjectStatus) {
    const res = await fetch(`/api/projects/${p.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setProjects(prev => prev.map(x => x.id === updated.id ? { ...x, status: updated.status } : x))
      if (active?.id === p.id) setActive(a => a ? { ...a, status: updated.status } : a)
    }
  }

  async function deleteProject(id: number) {
    if (!confirm('Delete this project? This cannot be undone.')) return
    await fetch(`/api/projects/${id}`, { method:'DELETE', credentials:'include' })
    setProjects(prev => prev.filter(p => p.id !== id))
    if (active?.id === id) setActive(null)
  }

  async function addMilestone() {
    if (!msTitle.trim() || !active) return
    setMsAdding(true)
    const res = await fetch(`/api/projects/${active.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ add_milestone: true, title: msTitle.trim(), due_date: msDate }),
    })
    if (res.ok) {
      const ms: Milestone = await res.json()
      const updated = { ...active, milestones: [...active.milestones, ms] }
      setActive(updated)
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
      setMsTitle(''); setMsDate('')
    }
    setMsAdding(false)
  }

  async function toggleMilestone(ms: Milestone) {
    if (!active) return
    const newStatus = ms.status === 'completed' ? 'pending' : 'completed'
    const res = await fetch(`/api/milestones/${ms.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated: Milestone = await res.json()
      const newMs = active.milestones.map(m => m.id === updated.id ? updated : m)
      setActive({ ...active, milestones: newMs })
    }
  }

  async function deleteMilestone(msId: number) {
    if (!active) return
    await fetch(`/api/milestones/${msId}`, { method:'DELETE', credentials:'include' })
    setActive({ ...active, milestones: active.milestones.filter(m => m.id !== msId) })
  }

  async function openEdit() {
    if (!active) return
    setEditForm({
      name:        active.name,
      description: active.description,
      company:     active.company,
      owner:       active.owner,
      status:      active.status,
      start_date:  active.start_date,
      end_date:    active.end_date,
      budget:      String(active.budget || ''),
    })
    setShowEdit(true)
  }

  async function saveEdit() {
    if (!active || !editForm.name.trim()) return
    setEditSaving(true)
    const res = await fetch(`/api/projects/${active.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        name:        editForm.name.trim(),
        description: editForm.description,
        company:     editForm.company,
        owner:       editForm.owner,
        status:      editForm.status,
        start_date:  editForm.start_date || null,
        end_date:    editForm.end_date   || null,
        budget:      Number(editForm.budget) || 0,
      }),
    })
    if (res.ok) {
      const updated = await res.json()
      const merged: Project = { ...updated, milestones: active.milestones, task_count: active.task_count, done_count: active.done_count }
      setActive(merged)
      setProjects(prev => prev.map(p => p.id === merged.id ? merged : p))
      setShowEdit(false)
    }
    setEditSaving(false)
  }

  async function openLinkTask() {
    setShowLinkTask(true)
    setLinkSearch('')
    if (allTasks.length === 0) {
      setLinkLoading(true)
      const res = await fetch('/api/tasks', { credentials: 'include' })
      if (res.ok) setAllTasks(await res.json())
      setLinkLoading(false)
    }
  }

  async function linkTask(taskId: string | number) {
    if (!active) return
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ project_id: active.id }),
    })
    if (res.ok) {
      setAllTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, project_id: active.id } : t))
      const detailRes = await fetch(`/api/projects/${active.id}`, { credentials: 'include' })
      if (detailRes.ok) {
        const data = await detailRes.json()
        setTasks(data.tasks || [])
        const tc = data.project.task_count; const dc = data.project.done_count
        setActive(a => a ? { ...a, task_count: tc, done_count: dc } : a)
        setProjects(prev => prev.map(p => p.id === active.id ? { ...p, task_count: tc, done_count: dc } : p))
      }
      setShowLinkTask(false)
    }
  }

  async function unlinkTask(taskId: string | number) {
    if (!active) return
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ project_id: null }),
    })
    setAllTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, project_id: null } : t))
    setTasks(prev => prev.filter(t => String(t.id) !== String(taskId)))
    setActive(a => a ? { ...a, task_count: Math.max(0, a.task_count - 1) } : a)
    setProjects(prev => prev.map(p => p.id === active.id ? { ...p, task_count: Math.max(0, p.task_count - 1) } : p))
  }

  const inp: React.CSSProperties = { width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'8px 10px', fontSize:13, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }
  const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', fontFamily:'Arial, sans-serif' }}>

      {/* NAV */}
      <div style={{ background:'#1a3a2a', padding:'0 14px', display:'flex', alignItems:'center', gap:12, height:50, flexShrink:0 }}>
        <span style={{ background:'#b5833a', color:'white', fontWeight:800, fontSize:11, padding:'4px 9px', borderRadius:4, letterSpacing:'1px' }}>PABARI</span>
        <span style={{ fontSize:13, fontWeight:700, color:'white' }}>PABARI GROUP</span>
        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.15)', margin:'0 4px' }}/>
        <a href="/" style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none', fontSize:12 }}>← Portal</a>
        <a href="/tasks" style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none', fontSize:12 }}>Task Board</a>
        <a href="/projects" style={{ color:'white', textDecoration:'none', fontSize:12, fontWeight:600, borderBottom:'2px solid #b5833a', paddingBottom:2 }}>Projects</a>
        <div style={{ flex:1 }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,255,255,0.08)', borderRadius:20, padding:'3px 10px 3px 5px' }}>
          <div style={{ width:24, height:24, borderRadius:'50%', background:avatarColor(currentUser.name), color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {avatarInitials(currentUser.name)}
          </div>
          <span style={{ fontSize:12, color:'white', fontWeight:500 }}>{currentUser.name}</span>
        </div>
        {canEdit && (
          <button onClick={()=>setShowForm(true)}
            style={{ background:'#b5833a', color:'white', border:'none', padding:'6px 14px', borderRadius:5, fontSize:12, fontWeight:600, cursor:'pointer' }}>
            + New Project
          </button>
        )}
      </div>

      {/* CONTENT */}
      <div style={{ flex:1, overflow:'hidden', display:'flex' }}>

        {/* PROJECT LIST */}
        <div style={{ width: active ? 380 : '100%', flexShrink:0, overflowY:'auto', borderRight:'1px solid #e5e7eb', background:'#f9fafb', transition:'width 0.2s' }}>
          {/* Filters */}
          <div style={{ padding:'12px 16px', background:'white', borderBottom:'1px solid #e5e7eb', display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as ProjectStatus|'')}
              style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'5px 9px', fontSize:12, background:'white' }}>
              <option value="">All Statuses</option>
              {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(s=>(
                <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
              ))}
            </select>
            <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)}
              style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'5px 9px', fontSize:12, background:'white' }}>
              <option value="">All Companies</option>
              {[...COMPANIES].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ marginLeft:'auto', fontSize:12, color:'#9ca3af' }}>{filtered.length} project{filtered.length!==1?'s':''}</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign:'center', color:'#9ca3af', paddingTop:60, fontSize:13 }}>
              No projects yet.{canEdit && <> <button onClick={()=>setShowForm(true)} style={{ background:'none', border:'none', color:'#b5833a', cursor:'pointer', fontWeight:600, fontSize:13 }}>Create one</button></>}
            </div>
          ) : filtered.map(p => {
            const pct = progressPct(p.done_count, p.task_count)
            const style = PROJECT_STATUS_STYLE[p.status]
            const dl = daysLeft(p.end_date)
            const isActive = active?.id === p.id
            return (
              <div key={p.id} onClick={()=>openProject(p)}
                style={{ background: isActive ? '#f0fdf4' : 'white', borderBottom:'1px solid #e5e7eb', borderLeft: isActive ? '4px solid #1a3a2a' : '4px solid transparent', padding:'14px 16px', cursor:'pointer', transition:'background 0.1s' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:6 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'#111827', flex:1 }}>{p.name}</div>
                  <span style={{ background:style.bg, color:style.color, fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, whiteSpace:'nowrap', flexShrink:0 }}>
                    {PROJECT_STATUS_LABELS[p.status]}
                  </span>
                </div>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:8 }}>
                  {p.company} · {p.owner}
                  {p.end_date && <span style={{ marginLeft:6, color: dl < 0 ? '#dc2626' : dl <= 7 ? '#d97706' : '#9ca3af' }}>
                    · {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? 'Due today' : `${dl}d left`}
                  </span>}
                </div>
                {p.task_count > 0 && (
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af', marginBottom:3 }}>
                      <span>{p.done_count}/{p.task_count} tasks</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height:4, background:'#e5e7eb', borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background: pct===100 ? '#15803d' : '#1a3a2a', borderRadius:2, transition:'width 0.3s' }}/>
                    </div>
                  </div>
                )}
                {p.milestones.length > 0 && (
                  <div style={{ marginTop:6, fontSize:10, color:'#9ca3af' }}>
                    {p.milestones.filter(m=>m.status==='completed').length}/{p.milestones.length} milestones
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* PROJECT DETAIL */}
        {active && (
          <div style={{ flex:1, overflowY:'auto', background:'white' }}>
            {/* Detail header */}
            <div style={{ background:'#1a3a2a', padding:'16px 20px', color:'white', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:18, fontWeight:700, marginBottom:4 }}>{active.name}</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.65)' }}>
                  {active.company} · Owner: {active.owner}
                  {active.start_date && ` · ${fmtDate(active.start_date)} → ${active.end_date ? fmtDate(active.end_date) : 'No end date'}`}
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {canChangeStatus && (
                  <select value={active.status} onChange={e=>updateStatus(active, e.target.value as ProjectStatus)}
                    style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.3)', borderRadius:5, padding:'4px 8px', fontSize:12, cursor:'pointer' }}>
                    {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(s=>(
                      <option key={s} value={s} style={{ color:'#111', background:'white' }}>{PROJECT_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                )}
                {canEdit && (
                  <button onClick={openEdit}
                    style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.3)', borderRadius:5, padding:'4px 10px', fontSize:11, cursor:'pointer' }}>
                    ✏ Edit
                  </button>
                )}
                {canDelete && (
                  <button onClick={()=>deleteProject(active.id)}
                    style={{ background:'rgba(220,38,38,0.2)', color:'#fca5a5', border:'1px solid rgba(220,38,38,0.3)', borderRadius:5, padding:'4px 10px', fontSize:11, cursor:'pointer' }}>
                    Delete
                  </button>
                )}
                <button onClick={()=>setActive(null)}
                  style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'none', borderRadius:5, padding:'4px 10px', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
              </div>
            </div>

            {/* Detail tab bar */}
            <div style={{ borderBottom:'1px solid #e5e7eb', display:'flex', padding:'0 20px', background:'white' }}>
              {(['overview','thread','gantt'] as const).map(tab => (
                <button key={tab} onClick={()=>setDetailTab(tab)}
                  style={{ border:'none', borderBottom: detailTab===tab ? '2px solid #1a3a2a' : '2px solid transparent', background:'transparent', padding:'10px 16px', cursor:'pointer', fontSize:12.5, fontWeight: detailTab===tab ? 700 : 400, color: detailTab===tab ? '#1a3a2a' : '#6b7280', textTransform:'capitalize' }}>
                  {tab === 'thread' ? '💬 Thread' : tab === 'gantt' ? '📅 Timeline' : '📋 Overview'}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:24 }}>

              {/* Progress + budget row */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {[
                  { label:'Task Progress', value: `${active.done_count}/${active.task_count} resolved`, sub: `${progressPct(active.done_count, active.task_count)}% complete`, pct: progressPct(active.done_count, active.task_count) },
                  { label:'Milestones',    value: `${active.milestones.filter(m=>m.status==='completed').length}/${active.milestones.length} completed`, sub: active.milestones.length===0 ? 'None added yet' : `${Math.round((active.milestones.filter(m=>m.status==='completed').length/active.milestones.length)*100)}% done`, pct: active.milestones.length===0 ? 0 : Math.round((active.milestones.filter(m=>m.status==='completed').length/active.milestones.length)*100) },
                  { label:'Budget',        value: active.budget > 0 ? `KES ${active.budget.toLocaleString()}` : 'Not set', sub: active.spent > 0 ? `KES ${active.spent.toLocaleString()} spent` : 'No spend logged', pct: active.budget > 0 ? Math.min(100, Math.round((active.spent/active.budget)*100)) : 0 },
                ].map(kpi=>(
                  <div key={kpi.label} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'12px 14px' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>{kpi.label}</div>
                    <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:2 }}>{kpi.value}</div>
                    <div style={{ fontSize:11, color:'#6b7280', marginBottom:6 }}>{kpi.sub}</div>
                    <div style={{ height:4, background:'#e5e7eb', borderRadius:2 }}>
                      <div style={{ height:'100%', width:`${kpi.pct}%`, background: kpi.pct===100?'#15803d':'#1a3a2a', borderRadius:2 }}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Description */}
              {active.description && (
                <div>
                  <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:6 }}>Description</div>
                  <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{active.description}</div>
                </div>
              )}

              {/* Milestones */}
              <div>
                <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:10 }}>Milestones</div>
                {active.milestones.length === 0 && !canEdit && (
                  <div style={{ fontSize:12, color:'#9ca3af' }}>No milestones added.</div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {active.milestones.map(ms => {
                    const dl = daysLeft(ms.due_date)
                    const done = ms.status === 'completed'
                    return (
                      <div key={ms.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background: done ? '#f0fdf4' : '#f9fafb', border:`1px solid ${done?'#bbf7d0':'#e5e7eb'}`, borderRadius:6 }}>
                        <button onClick={()=>canEdit&&toggleMilestone(ms)}
                          style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${done?'#15803d':'#d1d5db'}`, background:done?'#15803d':'white', cursor:canEdit?'pointer':'default', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {done && <span style={{ color:'white', fontSize:11, lineHeight:1 }}>✓</span>}
                        </button>
                        <div style={{ flex:1 }}>
                          <span style={{ fontSize:13, color: done?'#6b7280':'#111827', textDecoration: done?'line-through':'none', fontWeight:500 }}>{ms.title}</span>
                          {ms.due_date && (
                            <span style={{ marginLeft:8, fontSize:11, color: done?'#9ca3af': dl<0?'#dc2626':dl<=3?'#d97706':'#9ca3af', fontWeight: dl<0&&!done?600:400 }}>
                              {fmtDate(ms.due_date)}{!done && dl<0 ? ` (${Math.abs(dl)}d overdue)` : !done&&dl===0?' (today)':''}
                            </span>
                          )}
                        </div>
                        {canDelete && (
                          <button onClick={()=>deleteMilestone(ms.id)}
                            style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1 }}
                            title="Delete milestone">✕</button>
                        )}
                      </div>
                    )
                  })}
                </div>

                {canEdit && (
                  <div style={{ display:'flex', gap:8, marginTop:10 }}>
                    <input value={msTitle} onChange={e=>setMsTitle(e.target.value)}
                      placeholder="Add milestone…"
                      onKeyDown={e=>{ if(e.key==='Enter') addMilestone() }}
                      style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 10px', fontSize:12, outline:'none' }}/>
                    <input type="date" value={msDate} onChange={e=>setMsDate(e.target.value)}
                      style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'6px 8px', fontSize:12, outline:'none' }}/>
                    <button onClick={addMilestone} disabled={!msTitle.trim()||msAdding}
                      style={{ background:msTitle.trim()?'#1a3a2a':'#e5e7eb', color:msTitle.trim()?'white':'#9ca3af', border:'none', borderRadius:5, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:msTitle.trim()?'pointer':'default' }}>
                      {msAdding?'…':'Add'}
                    </button>
                  </div>
                )}
              </div>

              {/* Linked tasks */}
              <div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px' }}>
                    Linked Tasks {tasks.length > 0 && `(${tasks.length})`}
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {canEdit && (
                      <button onClick={openLinkTask}
                        style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:5, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                        + Link Task
                      </button>
                    )}
                    <a href="/tasks" style={{ fontSize:11, color:'#1a3a2a', fontWeight:600, textDecoration:'none' }}>Task Board →</a>
                  </div>
                </div>

                {tasks.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:showLinkTask ? 12 : 0 }}>
                    {tasks.map((t:any) => {
                      const dot = t.status==='resolved'?'#15803d':t.status==='action-required'?'#dc2626':'#d97706'
                      return (
                        <div key={t.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:5 }}>
                          <div style={{ width:8, height:8, borderRadius:'50%', background:dot, flexShrink:0 }}/>
                          <span style={{ flex:1, fontSize:12, color:'#111827' }}>{t.particulars}</span>
                          <span style={{ fontSize:10, color:'#9ca3af', marginRight:4 }}>{t.company} · {t.responsible}</span>
                          {canEdit && (
                            <button onClick={()=>unlinkTask(t.id)} title="Unlink from project"
                              style={{ background:'none', border:'1px solid #e5e7eb', color:'#9ca3af', borderRadius:4, padding:'1px 6px', fontSize:10, cursor:'pointer', flexShrink:0 }}>
                              ✕
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {tasks.length === 0 && !showLinkTask && (
                  <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>
                    No tasks linked yet.{canEdit && <> Click <strong>+ Link Task</strong> to connect existing tasks, or select this project when creating a new task.</>}
                  </div>
                )}

                {/* Link task search panel */}
                {showLinkTask && (
                  <div style={{ border:'1px solid #d1d5db', borderRadius:8, overflow:'hidden', marginTop:8 }}>
                    <div style={{ background:'#f9fafb', padding:'10px 12px', borderBottom:'1px solid #e5e7eb', display:'flex', gap:8, alignItems:'center' }}>
                      <input autoFocus value={linkSearch} onChange={e=>setLinkSearch(e.target.value)}
                        placeholder="Search by task name, person, or company…"
                        style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 10px', fontSize:12, outline:'none' }}/>
                      <button onClick={()=>setShowLinkTask(false)}
                        style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:16, lineHeight:1, padding:'0 4px' }}>✕</button>
                    </div>
                    <div style={{ maxHeight:220, overflowY:'auto', background:'white' }}>
                      {linkLoading ? (
                        <div style={{ padding:16, textAlign:'center', fontSize:12, color:'#9ca3af' }}>Loading tasks…</div>
                      ) : (() => {
                        const linkedIds = new Set(tasks.map((t:any) => String(t.id)))
                        const q = linkSearch.toLowerCase()
                        const available = (allTasks as any[]).filter(t =>
                          !linkedIds.has(String(t.id)) &&
                          (!q || t.particulars?.toLowerCase().includes(q) || t.responsible?.toLowerCase().includes(q) || t.company?.toLowerCase().includes(q))
                        )
                        if (available.length === 0) return (
                          <div style={{ padding:16, textAlign:'center', fontSize:12, color:'#9ca3af' }}>
                            {linkSearch ? 'No tasks match your search.' : 'All tasks are already linked to this project.'}
                          </div>
                        )
                        return available.slice(0, 40).map((t:any) => (
                          <div key={t.id} onClick={()=>linkTask(t.id)}
                            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', cursor:'pointer', borderBottom:'1px solid #f9fafb', background:'white' }}
                            onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#f0fdf4'}
                            onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='white'}>
                            <div style={{ width:7, height:7, borderRadius:'50%', background: t.status==='resolved'?'#15803d':t.status==='action-required'?'#dc2626':'#d97706', flexShrink:0 }}/>
                            <span style={{ flex:1, fontSize:12, color:'#111827' }}>{t.particulars}</span>
                            <span style={{ fontSize:10, color:'#9ca3af', whiteSpace:'nowrap' }}>{t.company} · {t.responsible}</span>
                          </div>
                        ))
                      })()}
                    </div>
                  </div>
                )}
              </div>

            </div>}

            {/* THREAD TAB */}
            {detailTab === 'thread' && (
              <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 200px)' }}>
                <div style={{ flex:1, overflowY:'auto', padding:'16px 24px', display:'flex', flexDirection:'column', gap:10 }}>
                  {notes.length === 0 && (
                    <div style={{ textAlign:'center', color:'#9ca3af', paddingTop:40, fontSize:13 }}>No messages yet. Start the conversation.</div>
                  )}
                  {notes.map(n => {
                    const isMe = n.user_name === currentUser.name
                    return (
                      <div key={n.id} style={{ display:'flex', flexDirection: isMe?'row-reverse':'row', gap:8, alignItems:'flex-end' }}>
                        <div style={{ width:28, height:28, borderRadius:'50%', background:avatarColor(n.user_name), color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {avatarInitials(n.user_name)}
                        </div>
                        <div style={{ maxWidth:'70%' }}>
                          {!isMe && <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:2, marginLeft:2 }}>{n.user_name}</div>}
                          <div style={{ padding:'8px 12px', borderRadius: isMe?'12px 12px 2px 12px':'12px 12px 12px 2px', background: isMe?'#1a3a2a':'#f3f4f6', color: isMe?'white':'#111827', fontSize:13, lineHeight:1.5 }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize:9, color:'#9ca3af', marginTop:2, textAlign: isMe?'right':'left' }}>
                            {new Date(n.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · {new Date(n.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
                          </div>
                        </div>
                        {isMe && canEdit && (
                          <button onClick={()=>deleteNote(n.id)} style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:12, padding:'0 2px', alignSelf:'flex-start', marginTop:4 }} title="Delete">✕</button>
                        )}
                      </div>
                    )
                  })}
                  <div ref={threadBottomRef}/>
                </div>
                <div style={{ borderTop:'1px solid #e5e7eb', padding:'12px 20px', display:'flex', gap:8 }}>
                  <input value={noteDraft} onChange={e=>setNoteDraft(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();postNote()} }}
                    placeholder="Write a message…"
                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'8px 12px', fontSize:13, outline:'none' }}/>
                  <button onClick={postNote} disabled={!noteDraft.trim()||noteSaving}
                    style={{ background: noteDraft.trim()?'#1a3a2a':'#e5e7eb', color: noteDraft.trim()?'white':'#9ca3af', border:'none', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, cursor: noteDraft.trim()?'pointer':'default' }}>
                    {noteSaving?'…':'Send'}
                  </button>
                </div>
              </div>
            )}

            {/* GANTT / TIMELINE TAB */}
            {detailTab === 'gantt' && (() => {
              const today = new Date(); today.setHours(0,0,0,0)

              if (!active.start_date || !active.end_date) return (
                <div style={{ padding:60, textAlign:'center', color:'#9ca3af', fontSize:13 }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📅</div>
                  Set a start and end date on this project to see the timeline.
                </div>
              )

              const startD    = new Date(active.start_date + 'T00:00:00')
              const endD      = new Date(active.end_date   + 'T00:00:00')
              const totalDays = (endD.getTime() - startD.getTime()) / 86400000

              // Padding: 3% of range, minimum 7 days
              const padMs     = Math.max(7 * 86400000, (endD.getTime() - startD.getTime()) * 0.03)
              const rangeStart = new Date(startD.getTime() - padMs)
              const rangeEnd   = new Date(endD.getTime()   + padMs)
              const totalMs    = rangeEnd.getTime() - rangeStart.getTime()

              function pct(d: Date) {
                return Math.max(0, Math.min(100, ((d.getTime() - rangeStart.getTime()) / totalMs) * 100))
              }

              // Adaptive tick generation — yearly for >2yr, quarterly for >6mo, monthly otherwise
              function buildTicks(): { label: string; p: number }[] {
                const out: { label: string; p: number }[] = []
                const cur = new Date(rangeStart)
                if (totalDays > 730) {
                  // Yearly ticks
                  cur.setMonth(0); cur.setDate(1)
                  while (cur <= rangeEnd) {
                    out.push({ label: String(cur.getFullYear()), p: pct(new Date(cur)) })
                    cur.setFullYear(cur.getFullYear() + 1)
                  }
                } else if (totalDays > 180) {
                  // Quarterly ticks
                  cur.setDate(1); cur.setMonth(Math.floor(cur.getMonth() / 3) * 3)
                  while (cur <= rangeEnd) {
                    out.push({ label: `Q${Math.floor(cur.getMonth() / 3) + 1} ${cur.getFullYear()}`, p: pct(new Date(cur)) })
                    cur.setMonth(cur.getMonth() + 3)
                  }
                } else if (totalDays > 14) {
                  // Monthly ticks
                  cur.setDate(1)
                  while (cur <= rangeEnd) {
                    out.push({ label: cur.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }), p: pct(new Date(cur)) })
                    cur.setMonth(cur.getMonth() + 1)
                  }
                } else {
                  // Weekly ticks
                  cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7))
                  while (cur <= rangeEnd) {
                    out.push({ label: cur.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }), p: pct(new Date(cur)) })
                    cur.setDate(cur.getDate() + 7)
                  }
                }
                return out.filter(t => t.p >= 0 && t.p <= 101)
              }

              const ticks    = buildTicks()
              const todayPct = pct(today)
              const barStart = pct(startD)
              const barEnd   = pct(endD)
              const barWidth = Math.max(barEnd - barStart, 0.4)
              const milestonesWithDates = active.milestones.filter(ms => ms.due_date)

              // Allocate enough pixels per tick so labels never cramp
              const pxPerTick = totalDays > 730 ? 110 : totalDays > 180 ? 90 : 75
              const chartWidth = Math.max(640, ticks.length * pxPerTick)

              return (
                <div style={{ padding:'24px 28px', overflowX:'auto' }}>
                  <div style={{ width: chartWidth }}>

                    {/* Ruler */}
                    <div style={{ position:'relative', height:32, borderBottom:'2px solid #e5e7eb' }}>
                      {ticks.map((t, i) => (
                        <div key={i} style={{ position:'absolute', left:`${t.p}%`, top:0, bottom:0 }}>
                          <div style={{ width:1, height:6, background:'#d1d5db', marginTop:18 }}/>
                          <span style={{ position:'absolute', top:4, left:4, fontSize:11, fontWeight:600, color:'#6b7280', whiteSpace:'nowrap' }}>{t.label}</span>
                        </div>
                      ))}
                      {/* Today marker in ruler */}
                      {todayPct > 0 && todayPct < 100 && (
                        <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:2, background:'#ef4444', zIndex:2 }}/>
                      )}
                    </div>

                    {/* Grid + rows */}
                    <div style={{ position:'relative' }}>
                      {/* Grid lines */}
                      {ticks.map((t, i) => (
                        <div key={i} style={{ position:'absolute', left:`${t.p}%`, top:0, bottom:0, width:1, background:'#f3f4f6', zIndex:0 }}/>
                      ))}

                      {/* Today vertical line */}
                      {todayPct > 0 && todayPct < 100 && (
                        <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:2, background:'#ef4444', zIndex:5 }}>
                          <div style={{ position:'absolute', top:14, left:5, background:'#ef4444', color:'white', fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:3, whiteSpace:'nowrap' }}>TODAY</div>
                        </div>
                      )}

                      {/* Project bar row */}
                      <div style={{ position:'relative', height:60, display:'flex', alignItems:'center', borderBottom:'1px solid #f0f0f0' }}>
                        {/* Bar */}
                        <div style={{ position:'absolute', left:`${barStart}%`, width:`${barWidth}%`, height:32, background:'linear-gradient(90deg,#1a3a2a 0%,#2d6a4f 100%)', borderRadius:7, boxShadow:'0 2px 10px rgba(26,58,42,0.22)', display:'flex', alignItems:'center', overflow:'hidden', zIndex:2, minWidth:6 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'white', paddingLeft:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{active.name}</span>
                        </div>
                        {/* Start label */}
                        <div style={{ position:'absolute', left:`${barStart}%`, bottom:4, transform:'translateX(-50%)', fontSize:9, color:'#9ca3af', whiteSpace:'nowrap', fontWeight:500 }}>{fmtDate(active.start_date)}</div>
                        {/* End label */}
                        <div style={{ position:'absolute', left:`${barEnd}%`, bottom:4, transform:'translateX(-50%)', fontSize:9, color:'#9ca3af', whiteSpace:'nowrap', fontWeight:500 }}>{fmtDate(active.end_date)}</div>
                      </div>

                      {/* Milestone rows */}
                      {milestonesWithDates.map(ms => {
                        const mp   = pct(new Date(ms.due_date + 'T00:00:00'))
                        const done = ms.status === 'completed'
                        const flipRight = mp < 10
                        return (
                          <div key={ms.id} style={{ position:'relative', height:44, borderBottom:'1px solid #f9fafb' }}>
                            {/* Track line */}
                            <div style={{ position:'absolute', left:0, right:0, top:'50%', height:1, background:'#f0f0f0' }}/>
                            {/* Diamond */}
                            <div style={{ position:'absolute', left:`${mp}%`, top:'50%', transform:'translate(-50%,-50%) rotate(45deg)', width:16, height:16, background:done?'#15803d':'#b5833a', border:'2.5px solid white', boxShadow:`0 0 0 1.5px ${done?'#15803d':'#b5833a'}`, zIndex:3 }}/>
                            {/* Label */}
                            <div style={{
                              position:'absolute',
                              top:5,
                              ...(flipRight
                                ? { left:`${mp + 1.5}%` }
                                : { left:`${mp}%`, transform:'translateX(-50%)' }),
                              fontSize:10, fontWeight:600,
                              color: done ? '#15803d' : '#374151',
                              whiteSpace:'nowrap', maxWidth:160,
                              overflow:'hidden', textOverflow:'ellipsis',
                              background:'white',
                              border:`1px solid ${done?'#bbf7d0':'#e5e7eb'}`,
                              borderRadius:4, padding:'2px 6px', zIndex:4,
                              boxShadow:'0 1px 3px rgba(0,0,0,0.06)',
                            }}>
                              {done && '✓ '}{ms.title}
                            </div>
                          </div>
                        )
                      })}

                      {milestonesWithDates.length === 0 && (
                        <div style={{ height:40, display:'flex', alignItems:'center', paddingLeft:8 }}>
                          <span style={{ fontSize:11, color:'#d1d5db' }}>No milestones with dates — add one in Overview.</span>
                        </div>
                      )}
                    </div>

                    {/* Legend */}
                    <div style={{ display:'flex', gap:18, flexWrap:'wrap', fontSize:11, color:'#6b7280', marginTop:18, paddingTop:14, borderTop:'1px solid #f3f4f6' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:20, height:10, background:'linear-gradient(90deg,#1a3a2a,#2d6a4f)', borderRadius:3, display:'inline-block' }}/>
                        Project duration
                      </span>
                      <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:11, height:11, background:'#b5833a', display:'inline-block', transform:'rotate(45deg)' }}/>
                        Pending milestone
                      </span>
                      <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:11, height:11, background:'#15803d', display:'inline-block', transform:'rotate(45deg)' }}/>
                        Completed milestone
                      </span>
                      <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:2, height:14, background:'#ef4444', display:'inline-block' }}/>
                        Today
                      </span>
                    </div>
                  </div>
                </div>
              )
            })()}

          </div>
        )}
      </div>

      {/* NEW PROJECT MODAL */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={()=>setShowForm(false)}>
          <div style={{ background:'white', borderRadius:12, padding:28, maxWidth:520, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>New Project</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={lbl}>Project Name *</label>
                <input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. PIL Factory Expansion" autoFocus style={inp}/>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                  rows={2} placeholder="Brief overview of the project…"
                  style={{ ...inp, resize:'vertical' }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Company *</label>
                  <select value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} style={inp}>
                    {[...COMPANIES].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Owner</label>
                  <select value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))} style={inp}>
                    {[...PEOPLE].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Start Date</label>
                  <input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} style={inp}/>
                </div>
                <div>
                  <label style={lbl}>End Date</label>
                  <input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} style={inp}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Budget (KES)</label>
                  <input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} placeholder="0" style={inp}/>
                </div>
                <div>
                  <label style={lbl}>Initial Status</label>
                  <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as ProjectStatus}))} style={inp}>
                    {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(s=>(
                      <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowForm(false)}
                style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'9px 18px', borderRadius:6, fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={createProject} disabled={saving||!form.name.trim()}
                style={{ background: saving||!form.name.trim() ? '#9ca3af' : '#1a3a2a', color:'white', border:'none', padding:'9px 22px', borderRadius:6, fontSize:13, fontWeight:600, cursor:saving||!form.name.trim()?'not-allowed':'pointer' }}>
                {saving ? 'Creating…' : 'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* EDIT PROJECT MODAL */}
      {showEdit && active && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={()=>setShowEdit(false)}>
          <div style={{ background:'white', borderRadius:12, padding:28, maxWidth:520, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>Edit Project</div>
              <button onClick={()=>setShowEdit(false)} style={{ background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div>
                <label style={lbl}>Project Name *</label>
                <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} autoFocus style={inp}/>
              </div>
              <div>
                <label style={lbl}>Description</label>
                <textarea value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))}
                  rows={2} style={{ ...inp, resize:'vertical' }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Company</label>
                  <select value={editForm.company} onChange={e=>setEditForm(f=>({...f,company:e.target.value}))} style={inp}>
                    {[...COMPANIES].map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Owner</label>
                  <select value={editForm.owner} onChange={e=>setEditForm(f=>({...f,owner:e.target.value}))} style={inp}>
                    {[...PEOPLE].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div>
                  <label style={lbl}>Start Date</label>
                  <input type="date" value={editForm.start_date} onChange={e=>setEditForm(f=>({...f,start_date:e.target.value}))} style={inp}/>
                </div>
                <div>
                  <label style={lbl}>End Date</label>
                  <input type="date" value={editForm.end_date} onChange={e=>setEditForm(f=>({...f,end_date:e.target.value}))} style={inp}/>
                </div>
              </div>
              <div>
                <label style={lbl}>Budget (KES)</label>
                <input type="number" value={editForm.budget} onChange={e=>setEditForm(f=>({...f,budget:e.target.value}))} placeholder="0" style={inp}/>
              </div>
            </div>

            <div style={{ display:'flex', gap:10, marginTop:22, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowEdit(false)}
                style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'9px 18px', borderRadius:6, fontSize:13, cursor:'pointer' }}>
                Cancel
              </button>
              <button onClick={saveEdit} disabled={editSaving||!editForm.name.trim()}
                style={{ background: editSaving||!editForm.name.trim() ? '#9ca3af' : '#1a3a2a', color:'white', border:'none', padding:'9px 22px', borderRadius:6, fontSize:13, fontWeight:600, cursor:editSaving||!editForm.name.trim()?'not-allowed':'pointer' }}>
                {editSaving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
