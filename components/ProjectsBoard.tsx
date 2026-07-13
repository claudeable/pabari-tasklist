'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Project, Milestone, ProjectStatus, RAGStatus, ProjectMember, StatusReport, ProjectExpense, SessionUser,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE, COMPANIES, PEOPLE,
} from '@/types'
import type { ProjectNote } from '@/lib/projects'

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS: Record<string, string> = {
  harshil:'#b5833a', sabina:'#6c5ce7', ahmad:'#e17055', ashok:'#0984e3',
  paul:'#2d6a4f', krishnan:'#00b894', yalelet:'#fd79a8', suresh:'#5f27cd',
  benson:'#00cec9', andu:'#d63031', yared:'#e84393', simon:'#74b9ff',
  pedro:'#6c5ce7', duncan:'#00b894', juma:'#e17055',
}

const RAG_CONFIG: Record<RAGStatus, { label: string; bg: string; color: string; dot: string }> = {
  'green':   { label: 'Green',   bg: '#dcfce7', color: '#15803d', dot: '#16a34a' },
  'amber':   { label: 'Amber',   bg: '#fef3c7', color: '#b45309', dot: '#d97706' },
  'red':     { label: 'Red',     bg: '#fee2e2', color: '#dc2626', dot: '#ef4444' },
  'not-set': { label: 'Not Set', bg: '#f3f4f6', color: '#6b7280', dot: '#d1d5db' },
}

const BLANK_FORM = {
  name:'', description:'', company:'BYTEWISE' as string, owner:'',
  status:'active' as ProjectStatus, rag_status:'not-set' as RAGStatus,
  start_date:'', end_date:'', budget:'',
}

const BLANK_TASK    = { particulars:'', responsible:'', due_date:'', priority:'medium', section:'General', category:'Other' }
const BLANK_REPORT  = { rag:'not-set' as RAGStatus, narrative:'', blockers:'', next_steps:'' }
const BLANK_EXPENSE = { description:'', amount:'', expense_date: new Date().toISOString().slice(0,10), category:'General' }

const EXPENSE_CATEGORIES = ['General','Materials','Labour','Transport','Equipment','Utilities','Professional Fees','Other']

const PCR_STATUS_LABEL: Record<string,string> = {
  pending_hos:'Pending HOS', pending_hod:'Pending HOD', pending_finance:'Pending Finance',
  approved:'Approved', rejected:'Rejected',
}
const PCR_STATUS_COLOR: Record<string,string> = {
  pending_hos:'#d97706', pending_hod:'#7c3aed', pending_finance:'#1d4ed8',
  approved:'#15803d', rejected:'#dc2626',
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function avatarColor(name: string) { return AVATAR_COLORS[name.toLowerCase().split(/[\s&./]+/)[0]] || '#2d6a4f' }
function avatarInitials(name: string) { return name.split(/[\s&./]+/).map(w=>w[0]).filter(Boolean).join('').toUpperCase().slice(0,2) }

function fmtDate(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function fmtDateShort(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
}

function fmtTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

function daysLeft(d: string): number {
  if (!d) return Infinity
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.ceil((new Date(d+'T00:00:00').getTime() - today.getTime()) / 86400000)
}

function progressPct(done: number, total: number) { return total === 0 ? 0 : Math.round((done / total) * 100) }

function computeHealth(p: Project): { score: number; label: string; color: string; details: string[] } {
  const today = new Date(); today.setHours(0,0,0,0)
  let pts = 0, max = 0
  const details: string[] = []

  if (p.start_date && p.end_date) {
    const startD = new Date(p.start_date + 'T00:00:00')
    const endD   = new Date(p.end_date   + 'T00:00:00')
    max += 40
    if (p.status === 'completed') {
      pts += 40; details.push('Schedule: completed on time')
    } else if (today <= endD) {
      const totalMs = endD.getTime() - startD.getTime()
      const elapsedMs = Math.max(0, today.getTime() - startD.getTime())
      const schedPct = totalMs > 0 ? Math.min(1, elapsedMs / totalMs) : 0
      const taskPct  = p.task_count > 0 ? p.done_count / p.task_count : schedPct
      const lag = schedPct - taskPct
      if      (lag <= 0.05)  { pts += 40; details.push('Schedule: on track') }
      else if (lag <= 0.20)  { pts += 24; details.push('Schedule: slightly behind') }
      else                   { pts += 6;  details.push('Schedule: behind schedule') }
    } else {
      pts += 0; details.push('Schedule: past end date')
    }
  }

  if (p.task_count > 0) {
    max += 30
    const pct = p.done_count / p.task_count
    if      (pct >= 0.8) { pts += 30; details.push(`Tasks: ${Math.round(pct*100)}% resolved`) }
    else if (pct >= 0.5) { pts += 20; details.push(`Tasks: ${Math.round(pct*100)}% resolved`) }
    else if (pct >= 0.2) { pts += 10; details.push(`Tasks: ${Math.round(pct*100)}% resolved`) }
    else                 { pts += 2;  details.push(`Tasks: ${Math.round(pct*100)}% resolved`) }
  }

  if (p.milestones.length > 0) {
    max += 30
    const overdue = p.milestones.filter(m =>
      m.status !== 'completed' && m.due_date && new Date(m.due_date+'T00:00:00') < today
    ).length
    if      (overdue === 0) { pts += 30; details.push('Milestones: all on track') }
    else if (overdue === 1) { pts += 15; details.push('Milestones: 1 overdue') }
    else                    { pts += 0;  details.push(`Milestones: ${overdue} overdue`) }
  }

  const score = max > 0 ? Math.round((pts / max) * 100) : 0
  const label = score >= 70 ? 'Healthy' : score >= 40 ? 'At Risk' : 'Critical'
  const color = score >= 70 ? '#15803d' : score >= 40 ? '#d97706' : '#dc2626'
  return { score, label, color, details }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { initialProjects: Project[]; currentUser: SessionUser }

export default function ProjectsBoard({ initialProjects, currentUser }: Props) {

  // Core
  const [projects,      setProjects]      = useState<Project[]>(initialProjects)
  const [active,        setActive]        = useState<Project | null>(null)
  const [tasks,         setTasks]         = useState<Record<string,unknown>[]>([])
  const [viewMode,      setViewMode]      = useState<'list'|'portfolio'>('list')

  // Filters
  const [filterStatus,  setFilterStatus]  = useState<ProjectStatus|''>('')
  const [filterCompany, setFilterCompany] = useState('')
  const [filterRAG,     setFilterRAG]     = useState<RAGStatus|''>('')

  // New project form
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({ ...BLANK_FORM, owner: currentUser.name })
  const [saving,    setSaving]    = useState(false)

  // Edit project
  const [showEdit,   setShowEdit]   = useState(false)
  const [editForm,   setEditForm]   = useState({ ...BLANK_FORM, owner: currentUser.name })
  const [editSaving, setEditSaving] = useState(false)

  // Search
  const [search, setSearch] = useState('')

  // Detail tab
  const [detailTab, setDetailTab] = useState<'overview'|'reports'|'thread'|'timeline'|'budget'>('overview')

  // Milestones
  const [msTitle,    setMsTitle]    = useState('')
  const [msDate,     setMsDate]     = useState('')
  const [msAdding,   setMsAdding]   = useState(false)
  const [editingMsId,   setEditingMsId]   = useState<number|null>(null)
  const [editingMsTitle,setEditingMsTitle] = useState('')
  const [editingMsDate, setEditingMsDate]  = useState('')
  const [msSaving,   setMsSaving]   = useState(false)

  // Thread
  const [notes,      setNotes]      = useState<ProjectNote[]>([])
  const [noteDraft,  setNoteDraft]  = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const threadBottomRef = useRef<HTMLDivElement>(null)

  // Members
  const [members,       setMembers]       = useState<ProjectMember[]>([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberToAdd,   setMemberToAdd]   = useState('')
  const [memberSaving,  setMemberSaving]  = useState(false)

  // Status reports
  const [reports,       setReports]       = useState<StatusReport[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [showNewReport, setShowNewReport] = useState(false)
  const [reportForm,    setReportForm]    = useState({ ...BLANK_REPORT })
  const [reportSaving,  setReportSaving]  = useState(false)

  // Link tasks
  const [allTasks,     setAllTasks]     = useState<Record<string,unknown>[]>([])
  const [showLinkTask, setShowLinkTask] = useState(false)
  const [linkSearch,   setLinkSearch]   = useState('')
  const [linkLoading,  setLinkLoading]  = useState(false)

  // Create task from project
  const [showCreateTask,    setShowCreateTask]    = useState(false)
  const [createTaskForm,    setCreateTaskForm]    = useState({ ...BLANK_TASK })
  const [createTaskSaving,  setCreateTaskSaving]  = useState(false)

  // Task filter inside project
  const [taskFilter, setTaskFilter] = useState<'all'|'active'|'resolved'>('all')

  // Budget / Expenses / PCRs
  const [expenses,       setExpenses]       = useState<ProjectExpense[]>([])
  const [pcrs,           setPcrs]           = useState<Record<string,unknown>[]>([])
  const [budgetLoaded,   setBudgetLoaded]   = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseForm,    setExpenseForm]    = useState({ ...BLANK_EXPENSE })
  const [expenseSaving,  setExpenseSaving]  = useState(false)

  // ── Permissions ──
  const canEdit = currentUser.role !== 'staff'
  const canDelete = currentUser.role === 'admin' || currentUser.role === 'director'
  const canChangeStatus = active
    ? (currentUser.role === 'admin' || currentUser.role === 'director' || currentUser.name === active.owner)
    : false

  // ── Derived data ──
  const filtered = useMemo(() => projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.owner.toLowerCase().includes(search.toLowerCase()) &&
        !p.company.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus  && p.status      !== filterStatus)  return false
    if (filterCompany && p.company     !== filterCompany) return false
    if (filterRAG     && p.rag_status  !== filterRAG)     return false
    return true
  }), [projects, filterStatus, filterCompany, filterRAG, search])

  const healthMap = useMemo(() => {
    const m: Record<number, ReturnType<typeof computeHealth>> = {}
    projects.forEach(p => { m[p.id] = computeHealth(p) })
    return m
  }, [projects])

  const filteredTasks = useMemo(() => {
    if (taskFilter === 'all') return tasks
    if (taskFilter === 'resolved') return tasks.filter((t:any) => t.status === 'resolved')
    return tasks.filter((t:any) => t.status !== 'resolved')
  }, [tasks, taskFilter])

  const overdueMs = useMemo(() => {
    if (!active) return []
    const today = new Date(); today.setHours(0,0,0,0)
    return active.milestones.filter(m =>
      m.status !== 'completed' && m.due_date && new Date(m.due_date+'T00:00:00') < today
    )
  }, [active])

  // ── Load reports when tab opens ──
  useEffect(() => {
    if (detailTab !== 'reports' || !active || reportsLoaded) return
    fetch(`/api/projects/${active.id}/reports`, { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setReports(Array.isArray(data) ? data : []); setReportsLoaded(true) })
      .catch(() => {})
  }, [detailTab, active?.id, reportsLoaded])

  // ── Load budget when tab opens ──
  useEffect(() => {
    if (detailTab !== 'budget' || !active || budgetLoaded) return
    fetch(`/api/projects/${active.id}/budget`, { credentials:'include' })
      .then(r => r.ok ? r.json() : { expenses:[], pcrs:[] })
      .then(data => {
        setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
        setPcrs(Array.isArray(data.pcrs) ? data.pcrs : [])
        setBudgetLoaded(true)
      })
      .catch(() => {})
  }, [detailTab, active?.id, budgetLoaded])

  // ── Core functions ──
  async function openProject(p: Project) {
    setActive(p)
    setDetailTab('overview')
    setNotes([]); setMembers([]); setTasks([])
    setReports([]); setReportsLoaded(false)
    setExpenses([]); setPcrs([]); setBudgetLoaded(false)
    setShowLinkTask(false); setTaskFilter('all')

    const [res, notesRes, membersRes] = await Promise.all([
      fetch(`/api/projects/${p.id}`, { credentials:'include' }),
      fetch(`/api/projects/${p.id}/notes`, { credentials:'include' }),
      fetch(`/api/projects/${p.id}/members`, { credentials:'include' }),
    ])
    if (res.ok) {
      const data = await res.json()
      setActive(data.project)
      setTasks(data.tasks || [])
      setProjects(prev => prev.map(x => x.id === data.project.id ? data.project : x))
    }
    if (notesRes.ok) {
      const d = await notesRes.json()
      setNotes(Array.isArray(d) ? d : [])
    }
    if (membersRes.ok) {
      const d = await membersRes.json()
      setMembers(Array.isArray(d) ? d : [])
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

  async function updateRAG(rag_status: RAGStatus) {
    if (!active) return
    const res = await fetch(`/api/projects/${active.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ rag_status }),
    })
    if (res.ok) {
      setActive(a => a ? { ...a, rag_status } : a)
      setProjects(prev => prev.map(p => p.id === active.id ? { ...p, rag_status } : p))
    }
  }

  async function deleteProject(id: number) {
    if (!confirm('Delete this project? All linked data will be removed.')) return
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

  function syncMilestones(projectId: number, newMs: Milestone[]) {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, milestones: newMs } : p))
  }

  async function toggleMilestone(ms: Milestone) {
    if (!active || !canEdit) return
    const newStatus = ms.status === 'completed' ? 'pending' : 'completed'
    const res = await fetch(`/api/milestones/${ms.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated: Milestone = await res.json()
      const newMs = active.milestones.map(m => m.id === updated.id ? updated : m)
      setActive(a => a ? { ...a, milestones: newMs } : a)
      syncMilestones(active.id, newMs)
    }
  }

  async function saveMilestoneEdit(ms: Milestone) {
    if (!active || msSaving) return
    setMsSaving(true)
    const res = await fetch(`/api/milestones/${ms.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ title: editingMsTitle.trim() || ms.title, due_date: editingMsDate }),
    })
    if (res.ok) {
      const updated: Milestone = await res.json()
      const newMs = active.milestones.map(m => m.id === updated.id ? updated : m)
      setActive(a => a ? { ...a, milestones: newMs } : a)
      syncMilestones(active.id, newMs)
    }
    setEditingMsId(null)
    setMsSaving(false)
  }

  async function deleteMilestone(msId: number) {
    if (!active) return
    await fetch(`/api/milestones/${msId}`, { method:'DELETE', credentials:'include' })
    const newMs = active.milestones.filter(m => m.id !== msId)
    setActive(a => a ? { ...a, milestones: newMs } : a)
    syncMilestones(active.id, newMs)
  }

  // Edit project
  function openEdit() {
    if (!active) return
    setEditForm({
      name:        active.name,
      description: active.description,
      company:     active.company,
      owner:       active.owner,
      status:      active.status,
      rag_status:  active.rag_status,
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
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({
        name:        editForm.name.trim(),
        description: editForm.description,
        company:     editForm.company,
        owner:       editForm.owner,
        status:      editForm.status,
        rag_status:  editForm.rag_status,
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

  // Members
  async function addMember() {
    if (!memberToAdd || !active) return
    setMemberSaving(true)
    const res = await fetch(`/api/projects/${active.id}/members`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ user_name: memberToAdd }),
    })
    if (res.ok) {
      const member: ProjectMember = await res.json()
      setMembers(prev => [...prev.filter(m => m.id !== member.id), member])
      setMemberToAdd(''); setShowAddMember(false)
    }
    setMemberSaving(false)
  }

  async function removeMember(userName: string) {
    if (!active) return
    await fetch(`/api/projects/${active.id}/members`, {
      method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ user_name: userName }),
    })
    setMembers(prev => prev.filter(m => m.user_name !== userName))
  }

  // Reports
  async function postReport() {
    if (!active || !reportForm.narrative.trim()) return
    setReportSaving(true)
    const res = await fetch(`/api/projects/${active.id}/reports`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify(reportForm),
    })
    if (res.ok) {
      const report: StatusReport = await res.json()
      setReports(prev => [report, ...prev])
      setReportForm({ ...BLANK_REPORT }); setShowNewReport(false)
    }
    setReportSaving(false)
  }

  async function deleteReport(reportId: number) {
    if (!active) return
    await fetch(`/api/projects/${active.id}/reports`, {
      method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ report_id: reportId }),
    })
    setReports(prev => prev.filter(r => r.id !== reportId))
  }

  // Link / unlink tasks
  async function openLinkTask() {
    setShowLinkTask(true); setLinkSearch('')
    if (allTasks.length === 0) {
      setLinkLoading(true)
      const res = await fetch('/api/tasks', { credentials:'include' })
      if (res.ok) setAllTasks(await res.json())
      setLinkLoading(false)
    }
  }

  async function linkTask(taskId: string | number) {
    if (!active) return
    const res = await fetch(`/api/tasks/${taskId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ project_id: active.id }),
    })
    if (res.ok) {
      setAllTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, project_id: active.id } : t))
      const dr = await fetch(`/api/projects/${active.id}`, { credentials:'include' })
      if (dr.ok) {
        const data = await dr.json()
        setTasks(data.tasks || [])
        const tc = data.project.task_count, dc = data.project.done_count
        setActive(a => a ? { ...a, task_count: tc, done_count: dc } : a)
        setProjects(prev => prev.map(p => p.id === active.id ? { ...p, task_count: tc, done_count: dc } : p))
      }
      setShowLinkTask(false)
    }
  }

  async function unlinkTask(taskId: string | number) {
    if (!active) return
    await fetch(`/api/tasks/${taskId}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ project_id: null }),
    })
    setAllTasks(prev => prev.map(t => String(t.id) === String(taskId) ? { ...t, project_id: null } : t))
    setTasks(prev => prev.filter(t => String(t.id) !== String(taskId)))
    setActive(a => a ? { ...a, task_count: Math.max(0, a.task_count - 1) } : a)
    setProjects(prev => prev.map(p => p.id === active.id ? { ...p, task_count: Math.max(0, p.task_count - 1) } : p))
  }

  // Create task from project
  async function submitCreateTask() {
    if (!active || !createTaskForm.particulars.trim()) return
    setCreateTaskSaving(true)
    const today = new Date()
    const dateStr = `${today.getDate()}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][today.getMonth()]}-${String(today.getFullYear()).slice(2)}`
    const res = await fetch('/api/tasks', {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({
        date:        dateStr,
        company:     active.company,
        section:     createTaskForm.section || 'General',
        category:    createTaskForm.category || 'Other',
        particulars: createTaskForm.particulars.trim(),
        responsible: createTaskForm.responsible || currentUser.name,
        payment:     'Non-Payment',
        status:      'action-required',
        priority:    createTaskForm.priority || 'medium',
        due_date:    createTaskForm.due_date || '',
        recurrence:  'none',
        project_id:  active.id,
      }),
    })
    if (res.ok) {
      const dr = await fetch(`/api/projects/${active.id}`, { credentials:'include' })
      if (dr.ok) {
        const data = await dr.json()
        setTasks(data.tasks || [])
        const tc = data.project.task_count, dc = data.project.done_count
        setActive(a => a ? { ...a, task_count: tc, done_count: dc } : a)
        setProjects(prev => prev.map(p => p.id === active.id ? { ...p, task_count: tc, done_count: dc } : p))
      }
      setCreateTaskForm({ ...BLANK_TASK })
      setShowCreateTask(false)
    }
    setCreateTaskSaving(false)
  }

  // Expense functions
  async function addExpense() {
    if (!active || !expenseForm.description.trim() || !expenseForm.amount) return
    setExpenseSaving(true)
    const res = await fetch(`/api/projects/${active.id}/budget`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify(expenseForm),
    })
    if (res.ok) {
      const expense: ProjectExpense = await res.json()
      setExpenses(prev => [expense, ...prev])
      const newSpent = (active.spent || 0) + expense.amount
      setActive(a => a ? { ...a, spent: newSpent } : a)
      setProjects(prev => prev.map(p => p.id === active.id ? { ...p, spent: newSpent } : p))
      setExpenseForm({ ...BLANK_EXPENSE })
      setShowAddExpense(false)
    }
    setExpenseSaving(false)
  }

  async function deleteExpense(expenseId: number, amount: number) {
    if (!active) return
    await fetch(`/api/projects/${active.id}/budget`, {
      method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ expense_id: expenseId }),
    })
    setExpenses(prev => prev.filter(e => e.id !== expenseId))
    const newSpent = Math.max(0, (active.spent || 0) - amount)
    setActive(a => a ? { ...a, spent: newSpent } : a)
    setProjects(prev => prev.map(p => p.id === active.id ? { ...p, spent: newSpent } : p))
  }

  // ── Style helpers ──
  const inp: React.CSSProperties = { width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'8px 10px', fontSize:13, boxSizing:'border-box', outline:'none', fontFamily:'inherit' }
  const lbl: React.CSSProperties = { display:'block', fontSize:11, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:5 }

  // ── RAG dot ──
  function RAGDot({ status, size=10 }: { status: RAGStatus; size?: number }) {
    const cfg = RAG_CONFIG[status]
    return <span style={{ display:'inline-block', width:size, height:size, borderRadius:'50%', background:cfg.dot, flexShrink:0, border:`1.5px solid ${cfg.color}20` }}/>
  }

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', fontFamily:'Arial, sans-serif' }}>

      {/* NAV */}
      <div style={{ background:'#1a3a2a', padding:'0 14px', display:'flex', alignItems:'center', gap:12, height:50, flexShrink:0 }}>
        <span style={{ background:'#b5833a', color:'white', fontWeight:800, fontSize:11, padding:'4px 9px', borderRadius:4, letterSpacing:'1px' }}>PABARI</span>
        <span style={{ fontSize:13, fontWeight:700, color:'white' }}>PABARI GROUP</span>
        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.15)', margin:'0 4px' }}/>
        <a href="/"      style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none', fontSize:12 }}>← Portal</a>
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

        {/* ── PROJECT LIST / PORTFOLIO ── */}
        <div style={{ width: active ? 340 : '100%', flexShrink:0, overflowY:'auto', borderRight:'1px solid #e5e7eb', background:'#f9fafb', transition:'width 0.2s', display:'flex', flexDirection:'column' }}>

          {/* Filter bar */}
          <div style={{ padding:'10px 12px', background:'white', borderBottom:'1px solid #e5e7eb', flexShrink:0 }}>
            {/* Search */}
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search projects…"
              style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'6px 10px', fontSize:12, boxSizing:'border-box', outline:'none', marginBottom:7 }}/>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', marginBottom:6 }}>
              <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value as ProjectStatus|'')}
                style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'4px 7px', fontSize:11, background:'white' }}>
                <option value="">All Statuses</option>
                {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(s=>(
                  <option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>
                ))}
              </select>
              <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)}
                style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'4px 7px', fontSize:11, background:'white' }}>
                <option value="">All Companies</option>
                {[...COMPANIES].map(c=><option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filterRAG} onChange={e=>setFilterRAG(e.target.value as RAGStatus|'')}
                style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'4px 7px', fontSize:11, background:'white' }}>
                <option value="">All RAG</option>
                {(['red','amber','green','not-set'] as RAGStatus[]).map(r=>(
                  <option key={r} value={r}>{RAG_CONFIG[r].label}</option>
                ))}
              </select>
              <span style={{ marginLeft:'auto', fontSize:11, color:'#9ca3af' }}>{filtered.length} project{filtered.length!==1?'s':''}</span>
            </div>
            {/* View toggle */}
            <div style={{ display:'flex', gap:4 }}>
              {(['list','portfolio'] as const).map(v=>(
                <button key={v} onClick={()=>{ setViewMode(v); if(v==='portfolio') setActive(null) }}
                  style={{ background: viewMode===v ? '#1a3a2a' : '#f3f4f6', color: viewMode===v ? 'white' : '#6b7280', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                  {v === 'list' ? '≡ List' : '⊞ Portfolio'}
                </button>
              ))}
            </div>
          </div>

          {/* ── LIST VIEW ── */}
          {viewMode === 'list' && (
            <div style={{ flex:1, overflowY:'auto' }}>
              {filtered.length === 0 ? (
                <div style={{ textAlign:'center', color:'#9ca3af', paddingTop:60, fontSize:13 }}>
                  No projects yet.{canEdit && <> <button onClick={()=>setShowForm(true)} style={{ background:'none', border:'none', color:'#b5833a', cursor:'pointer', fontWeight:600, fontSize:13 }}>Create one</button></>}
                </div>
              ) : filtered.map(p => {
                const pct = progressPct(p.done_count, p.task_count)
                const style = PROJECT_STATUS_STYLE[p.status]
                const dl = daysLeft(p.end_date)
                const isActive = active?.id === p.id
                const health = healthMap[p.id]
                return (
                  <div key={p.id} onClick={()=>openProject(p)}
                    style={{ background: isActive ? '#f0fdf4' : 'white', borderBottom:'1px solid #e5e7eb', borderLeft: isActive ? '4px solid #1a3a2a' : '4px solid transparent', padding:'12px 14px', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:6, marginBottom:4 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
                        <RAGDot status={p.rag_status} size={8}/>
                        <span style={{ fontWeight:700, fontSize:13, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                      </div>
                      <span style={{ background:style.bg, color:style.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, whiteSpace:'nowrap', flexShrink:0 }}>
                        {PROJECT_STATUS_LABELS[p.status]}
                      </span>
                    </div>
                    <div style={{ fontSize:11, color:'#6b7280', marginBottom:6 }}>
                      {p.company} · {p.owner}
                      {p.end_date && <span style={{ marginLeft:6, color: dl < 0 ? '#dc2626' : dl <= 7 ? '#d97706' : '#9ca3af' }}>
                        · {dl < 0 ? `${Math.abs(dl)}d overdue` : dl === 0 ? 'Due today' : `${dl}d left`}
                      </span>}
                    </div>
                    {p.task_count > 0 && (
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'#9ca3af', marginBottom:2 }}>
                          <span>{p.done_count}/{p.task_count} tasks</span>
                          <span style={{ color: health?.color }}>{health?.score ?? 0}% health</span>
                        </div>
                        <div style={{ height:3, background:'#e5e7eb', borderRadius:2, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: pct===100 ? '#15803d' : '#1a3a2a', borderRadius:2 }}/>
                        </div>
                      </div>
                    )}
                    {p.milestones.length > 0 && (
                      <div style={{ marginTop:4, fontSize:10, color:'#9ca3af' }}>
                        {p.milestones.filter(m=>m.status==='completed').length}/{p.milestones.length} milestones
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── PORTFOLIO VIEW ── */}
          {viewMode === 'portfolio' && (
            <div style={{ flex:1, overflowX:'auto', overflowY:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'#f3f4f6', borderBottom:'2px solid #e5e7eb' }}>
                    {['RAG','Project','Company','Owner','Health','Tasks','End Date','Status'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:'#9ca3af' }}>No projects match filters.</td></tr>
                  )}
                  {filtered.map(p => {
                    const h = healthMap[p.id]
                    const dl = daysLeft(p.end_date)
                    const s = PROJECT_STATUS_STYLE[p.status]
                    return (
                      <tr key={p.id} onClick={()=>openProject(p)}
                        style={{ borderBottom:'1px solid #f3f4f6', cursor:'pointer', background:'white' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='#f0fdf4'}
                        onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background='white'}>
                        <td style={{ padding:'8px 10px' }}><RAGDot status={p.rag_status} size={10}/></td>
                        <td style={{ padding:'8px 10px', fontWeight:600, color:'#111827', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</td>
                        <td style={{ padding:'8px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>{p.company}</td>
                        <td style={{ padding:'8px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>{p.owner}</td>
                        <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                          <span style={{ color: h?.color, fontWeight:700 }}>{h?.score ?? 0}%</span>
                          <span style={{ color:'#9ca3af', marginLeft:4, fontSize:10 }}>{h?.label}</span>
                        </td>
                        <td style={{ padding:'8px 10px', whiteSpace:'nowrap', color:'#374151' }}>
                          {p.done_count}/{p.task_count}
                        </td>
                        <td style={{ padding:'8px 10px', whiteSpace:'nowrap', color: dl<0?'#dc2626':dl<=7?'#d97706':'#6b7280' }}>
                          {p.end_date ? (dl<0?`${Math.abs(dl)}d overdue`:dl===0?'Today':fmtDateShort(p.end_date)) : '—'}
                        </td>
                        <td style={{ padding:'8px 10px' }}>
                          <span style={{ background:s.bg, color:s.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10 }}>
                            {PROJECT_STATUS_LABELS[p.status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── PROJECT DETAIL ── */}
        {active && (
          <div style={{ flex:1, overflowY:'auto', background:'white', display:'flex', flexDirection:'column' }}>

            {/* Detail header */}
            <div style={{ background:'#1a3a2a', padding:'14px 18px', color:'white', flexShrink:0 }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <RAGDot status={active.rag_status} size={10}/>
                    <span style={{ fontSize:17, fontWeight:700 }}>{active.name}</span>
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)' }}>
                    {active.company} · Owner: {active.owner}
                    {active.start_date && ` · ${fmtDate(active.start_date)} → ${active.end_date ? fmtDate(active.end_date) : 'No end date'}`}
                  </div>
                  {/* Health score row */}
                  {(() => {
                    const h = healthMap[active.id]
                    if (!h || (!active.start_date && !active.task_count && !active.milestones.length)) return null
                    return (
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.1)', borderRadius:4, padding:'2px 8px' }}>
                          <span style={{ fontSize:10, color:'rgba(255,255,255,0.7)' }}>Health</span>
                          <span style={{ fontSize:12, fontWeight:800, color: h.score>=70?'#86efac':h.score>=40?'#fde68a':'#fca5a5' }}>{h.score}%</span>
                          <span style={{ fontSize:10, color:'rgba(255,255,255,0.5)' }}>{h.label}</span>
                        </div>
                        {h.details.map((d,i) => (
                          <span key={i} style={{ fontSize:9, color:'rgba(255,255,255,0.45)', whiteSpace:'nowrap' }}>{d}</span>
                        ))}
                      </div>
                    )
                  })()}
                </div>
                <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                  {/* RAG selector */}
                  {canChangeStatus && (
                    <select value={active.rag_status} onChange={e=>updateRAG(e.target.value as RAGStatus)}
                      style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.3)', borderRadius:5, padding:'3px 7px', fontSize:11, cursor:'pointer' }}>
                      {(['not-set','green','amber','red'] as RAGStatus[]).map(r=>(
                        <option key={r} value={r} style={{ color:'#111', background:'white' }}>
                          {r==='green'?'🟢':r==='amber'?'🟡':r==='red'?'🔴':'⚪'} {RAG_CONFIG[r].label}
                        </option>
                      ))}
                    </select>
                  )}
                  {canChangeStatus && (
                    <select value={active.status} onChange={e=>updateStatus(active, e.target.value as ProjectStatus)}
                      style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.3)', borderRadius:5, padding:'3px 7px', fontSize:11, cursor:'pointer' }}>
                      {(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(s=>(
                        <option key={s} value={s} style={{ color:'#111', background:'white' }}>{PROJECT_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  )}
                  {canEdit && (
                    <button onClick={openEdit}
                      style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'1px solid rgba(255,255,255,0.3)', borderRadius:5, padding:'3px 9px', fontSize:11, cursor:'pointer' }}>
                      ✏ Edit
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={()=>deleteProject(active.id)}
                      style={{ background:'rgba(220,38,38,0.2)', color:'#fca5a5', border:'1px solid rgba(220,38,38,0.3)', borderRadius:5, padding:'3px 9px', fontSize:11, cursor:'pointer' }}>
                      Delete
                    </button>
                  )}
                  <button onClick={()=>setActive(null)}
                    style={{ background:'rgba(255,255,255,0.1)', color:'white', border:'none', borderRadius:5, padding:'3px 9px', fontSize:17, cursor:'pointer', lineHeight:1 }}>✕</button>
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ borderBottom:'1px solid #e5e7eb', display:'flex', padding:'0 18px', background:'white', flexShrink:0, overflowX:'auto' }}>
              {([
                { key:'overview',  label:'📋 Overview' },
                { key:'budget',    label:'💰 Budget' },
                { key:'reports',   label:'📊 Reports' },
                { key:'thread',    label:'💬 Thread' },
                { key:'timeline',  label:'📅 Timeline' },
              ] as const).map(tab => (
                <button key={tab.key} onClick={()=>setDetailTab(tab.key)}
                  style={{ border:'none', borderBottom: detailTab===tab.key ? '2px solid #1a3a2a' : '2px solid transparent', background:'transparent', padding:'9px 14px', cursor:'pointer', fontSize:12, fontWeight: detailTab===tab.key ? 700 : 400, color: detailTab===tab.key ? '#1a3a2a' : '#6b7280', whiteSpace:'nowrap' }}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW TAB ── */}
            {detailTab === 'overview' && (
              <div style={{ padding:'18px 22px', display:'flex', flexDirection:'column', gap:20, flex:1, overflowY:'auto' }}>

                {/* Overdue milestone warning */}
                {overdueMs.length > 0 && active.status !== 'completed' && (
                  <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:18 }}>⚠️</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:700, color:'#dc2626' }}>
                        {overdueMs.length} overdue milestone{overdueMs.length>1?'s':''}
                      </div>
                      <div style={{ fontSize:11, color:'#b91c1c', marginTop:2 }}>
                        {overdueMs.map(m => m.title).join(' · ')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Budget warning */}
                {active.budget > 0 && active.spent > 0 && (() => {
                  const pct = active.spent / active.budget
                  if (pct < 0.8) return null
                  const over = pct >= 1
                  return (
                    <div style={{ background: over?'#fef2f2':'#fffbeb', border:`1px solid ${over?'#fecaca':'#fde68a'}`, borderRadius:8, padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:18 }}>{over?'🚨':'⚠️'}</span>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color: over?'#dc2626':'#d97706' }}>
                          {over ? 'Budget exceeded' : 'Budget at risk'} — {Math.round(pct*100)}% used
                        </div>
                        <div style={{ fontSize:11, color: over?'#b91c1c':'#b45309', marginTop:1 }}>
                          KES {active.spent.toLocaleString()} of KES {active.budget.toLocaleString()} · {over ? `KES ${(active.spent-active.budget).toLocaleString()} over` : `KES ${(active.budget-active.spent).toLocaleString()} remaining`}
                          {' '}<button onClick={()=>setDetailTab('budget')} style={{ background:'none', border:'none', color:'inherit', textDecoration:'underline', cursor:'pointer', fontSize:11, fontWeight:600 }}>View Budget →</button>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* KPI cards */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
                  {[
                    {
                      label:'Task Progress',
                      value:`${active.done_count}/${active.task_count} resolved`,
                      sub:`${progressPct(active.done_count,active.task_count)}% complete`,
                      pct: progressPct(active.done_count,active.task_count),
                      barColor: '',
                    },
                    {
                      label:'Milestones',
                      value:`${active.milestones.filter(m=>m.status==='completed').length}/${active.milestones.length} done`,
                      sub: active.milestones.length===0 ? 'None added' : `${Math.round((active.milestones.filter(m=>m.status==='completed').length/active.milestones.length)*100)}%`,
                      pct: active.milestones.length===0 ? 0 : Math.round((active.milestones.filter(m=>m.status==='completed').length/active.milestones.length)*100),
                      barColor: '',
                    },
                    {
                      label:'Budget',
                      value: active.budget>0 ? `KES ${active.budget.toLocaleString()}` : 'Not set',
                      sub: active.spent>0 ? `KES ${active.spent.toLocaleString()} spent` : 'No spend logged',
                      pct: active.budget>0 ? Math.min(100,Math.round((active.spent/active.budget)*100)) : 0,
                      barColor: active.budget>0 && active.spent/active.budget>=1 ? '#dc2626' : active.budget>0 && active.spent/active.budget>=0.8 ? '#d97706' : '',
                    },
                  ].map(kpi=>(
                    <div key={kpi.label} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 12px' }}>
                      <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:3 }}>{kpi.label}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:'#111827', marginBottom:1 }}>{kpi.value}</div>
                      <div style={{ fontSize:11, color:'#6b7280', marginBottom:5 }}>{kpi.sub}</div>
                      <div style={{ height:3, background:'#e5e7eb', borderRadius:2 }}>
                        <div style={{ height:'100%', width:`${kpi.pct}%`, background:kpi.barColor||(kpi.pct===100?'#15803d':'#1a3a2a'), borderRadius:2 }}/>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Description */}
                {active.description && (
                  <div>
                    <div style={lbl}>Description</div>
                    <div style={{ fontSize:13, color:'#374151', lineHeight:1.6 }}>{active.description}</div>
                  </div>
                )}

                {/* Team Members */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={lbl}>Team Members ({members.length})</div>
                    {canEdit && !showAddMember && (
                      <button onClick={()=>setShowAddMember(true)}
                        style={{ background:'none', border:'1px solid #d1d5db', borderRadius:5, padding:'3px 9px', fontSize:11, color:'#374151', cursor:'pointer' }}>
                        + Add
                      </button>
                    )}
                  </div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                    {members.map(m=>(
                      <div key={m.id} style={{ display:'flex', alignItems:'center', gap:5, background:'#f3f4f6', borderRadius:20, padding:'3px 10px 3px 4px' }}>
                        <div style={{ width:22, height:22, borderRadius:'50%', background:avatarColor(m.user_name), color:'white', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {avatarInitials(m.user_name)}
                        </div>
                        <span style={{ fontSize:12, color:'#374151' }}>{m.user_name}</span>
                        {canEdit && (
                          <button onClick={()=>removeMember(m.user_name)}
                            style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:12, padding:0, lineHeight:1 }}>✕</button>
                        )}
                      </div>
                    ))}
                    {members.length===0 && <span style={{ fontSize:12, color:'#9ca3af' }}>No members added yet.</span>}
                  </div>
                  {showAddMember && (
                    <div style={{ display:'flex', gap:6, marginTop:8 }}>
                      <select value={memberToAdd} onChange={e=>setMemberToAdd(e.target.value)}
                        style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 8px', fontSize:12, outline:'none' }}>
                        <option value="">Select person…</option>
                        {[...PEOPLE].filter(p=>!members.some(m=>m.user_name===p)).map(p=>(
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      <button onClick={addMember} disabled={!memberToAdd||memberSaving}
                        style={{ background:memberToAdd?'#1a3a2a':'#e5e7eb', color:memberToAdd?'white':'#9ca3af', border:'none', borderRadius:5, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:memberToAdd?'pointer':'default' }}>
                        {memberSaving?'…':'Add'}
                      </button>
                      <button onClick={()=>{ setShowAddMember(false); setMemberToAdd('') }}
                        style={{ background:'#f3f4f6', color:'#6b7280', border:'none', borderRadius:5, padding:'6px 10px', fontSize:12, cursor:'pointer' }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Milestones */}
                <div>
                  <div style={lbl}>Milestones ({active.milestones.length})</div>
                  {active.milestones.length===0 && !canEdit && <div style={{ fontSize:12, color:'#9ca3af' }}>No milestones added.</div>}
                  <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                    {active.milestones.map(ms=>{
                      const dl = daysLeft(ms.due_date)
                      const done = ms.status==='completed'
                      const overdue = !done && ms.due_date && dl < 0
                      const isEditing = editingMsId === ms.id
                      return (
                        <div key={ms.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:done?'#f0fdf4':overdue?'#fff7f7':'#f9fafb', border:`1px solid ${done?'#bbf7d0':overdue?'#fecaca':'#e5e7eb'}`, borderRadius:6 }}>
                          {/* Toggle button */}
                          <button onClick={()=>canEdit&&toggleMilestone(ms)}
                            title={canEdit ? (done ? 'Mark as Pending' : 'Mark as Completed') : ms.status}
                            style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${done?'#15803d':overdue?'#ef4444':'#d1d5db'}`, background:done?'#15803d':'white', cursor:canEdit?'pointer':'default', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            {done && <span style={{ color:'white', fontSize:10 }}>✓</span>}
                          </button>

                          {/* Inline edit mode */}
                          {isEditing ? (
                            <>
                              <input value={editingMsTitle} onChange={e=>setEditingMsTitle(e.target.value)}
                                onKeyDown={e=>{ if(e.key==='Enter') saveMilestoneEdit(ms); if(e.key==='Escape') setEditingMsId(null) }}
                                autoFocus
                                style={{ flex:1, border:'1px solid #1a3a2a', borderRadius:4, padding:'3px 7px', fontSize:12, outline:'none' }} />
                              <input type="date" value={editingMsDate} onChange={e=>setEditingMsDate(e.target.value)}
                                style={{ border:'1px solid #d1d5db', borderRadius:4, padding:'3px 6px', fontSize:12 }} />
                              <button onClick={()=>saveMilestoneEdit(ms)} disabled={msSaving}
                                style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:4, padding:'3px 9px', fontSize:11, cursor:'pointer', fontWeight:600 }}>
                                {msSaving?'…':'Save'}
                              </button>
                              <button onClick={()=>setEditingMsId(null)}
                                style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:4, padding:'3px 7px', fontSize:11, cursor:'pointer', color:'#6b7280' }}>
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <div style={{ flex:1 }}>
                                <span style={{ fontSize:13, color:done?'#6b7280':'#111827', textDecoration:done?'line-through':'none', fontWeight:500 }}>{ms.title}</span>
                                {ms.due_date && (
                                  <span style={{ marginLeft:8, fontSize:11, color:done?'#9ca3af':overdue?'#dc2626':dl<=3?'#d97706':'#9ca3af', fontWeight:overdue?700:400 }}>
                                    {fmtDate(ms.due_date)}{overdue?` (${Math.abs(dl)}d overdue)`:dl===0&&!done?' (today)':''}
                                  </span>
                                )}
                              </div>
                              {canEdit && (
                                <button onClick={()=>{ setEditingMsId(ms.id); setEditingMsTitle(ms.title); setEditingMsDate(ms.due_date||'') }}
                                  title="Edit milestone"
                                  style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:12, padding:'0 3px', lineHeight:1 }}>✏️</button>
                              )}
                              {canDelete && (
                                <button onClick={()=>deleteMilestone(ms.id)}
                                  style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:13, padding:'0 2px' }}>✕</button>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {canEdit && (
                    <div style={{ display:'flex', gap:6, marginTop:8 }}>
                      <input value={msTitle} onChange={e=>setMsTitle(e.target.value)} placeholder="Add milestone…"
                        onKeyDown={e=>{ if(e.key==='Enter') addMilestone() }}
                        style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 9px', fontSize:12, outline:'none' }}/>
                      <input type="date" value={msDate} onChange={e=>setMsDate(e.target.value)}
                        style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'6px 7px', fontSize:12, outline:'none' }}/>
                      <button onClick={addMilestone} disabled={!msTitle.trim()||msAdding}
                        style={{ background:msTitle.trim()?'#1a3a2a':'#e5e7eb', color:msTitle.trim()?'white':'#9ca3af', border:'none', borderRadius:5, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:msTitle.trim()?'pointer':'default' }}>
                        {msAdding?'…':'Add'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Linked Tasks */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={lbl}>Linked Tasks {tasks.length>0 && `(${tasks.length})`}</div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      {canEdit && (
                        <>
                          <button onClick={()=>setShowCreateTask(true)}
                            style={{ background:'#b5833a', color:'white', border:'none', borderRadius:5, padding:'4px 9px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            + New Task
                          </button>
                          <button onClick={openLinkTask}
                            style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:5, padding:'4px 9px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                            Link Existing
                          </button>
                        </>
                      )}
                      <a href="/tasks" style={{ fontSize:11, color:'#1a3a2a', fontWeight:600, textDecoration:'none' }}>Task Board →</a>
                    </div>
                  </div>

                  {/* Task status filter */}
                  {tasks.length > 0 && (
                    <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                      {(['all','active','resolved'] as const).map(f=>(
                        <button key={f} onClick={()=>setTaskFilter(f)}
                          style={{ background: taskFilter===f ? '#1a3a2a' : '#f3f4f6', color: taskFilter===f ? 'white' : '#6b7280', border:'none', borderRadius:4, padding:'3px 8px', fontSize:10, fontWeight:600, cursor:'pointer', textTransform:'capitalize' }}>
                          {f==='all'?`All (${tasks.length})`:f==='resolved'?`Resolved (${tasks.filter((t:any)=>t.status==='resolved').length})`:`Active (${tasks.filter((t:any)=>t.status!=='resolved').length})`}
                        </button>
                      ))}
                    </div>
                  )}

                  {filteredTasks.length > 0 && (
                    <div style={{ display:'flex', flexDirection:'column', gap:3, marginBottom:showLinkTask?10:0 }}>
                      {filteredTasks.map((t:any)=>{
                        const dot = t.status==='resolved'?'#15803d':t.status==='action-required'?'#dc2626':'#d97706'
                        return (
                          <div key={t.id} style={{ display:'flex', alignItems:'center', gap:7, padding:'6px 9px', background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:5 }}>
                            <div style={{ width:7, height:7, borderRadius:'50%', background:dot, flexShrink:0 }}/>
                            <span style={{ flex:1, fontSize:12, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.particulars}</span>
                            <span style={{ fontSize:10, color:'#9ca3af', whiteSpace:'nowrap', marginRight:4 }}>{t.company} · {t.responsible}</span>
                            {t.due_date && <span style={{ fontSize:10, color: daysLeft(t.due_date)<0?'#dc2626':'#9ca3af', whiteSpace:'nowrap' }}>{fmtDateShort(t.due_date)}</span>}
                            {canEdit && (
                              <button onClick={()=>unlinkTask(t.id)} title="Unlink"
                                style={{ background:'none', border:'1px solid #e5e7eb', color:'#9ca3af', borderRadius:3, padding:'1px 5px', fontSize:10, cursor:'pointer', flexShrink:0 }}>✕</button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {tasks.length===0 && !showLinkTask && (
                    <div style={{ fontSize:12, color:'#9ca3af', padding:'6px 0' }}>
                      No tasks linked yet.{canEdit && <> Use <strong>+ New Task</strong> to create one here, or <strong>Link Existing</strong> to attach from the Task Board.</>}
                    </div>
                  )}

                  {/* Link task search */}
                  {showLinkTask && (
                    <div style={{ border:'1px solid #d1d5db', borderRadius:8, overflow:'hidden', marginTop:8 }}>
                      <div style={{ background:'#f9fafb', padding:'9px 11px', borderBottom:'1px solid #e5e7eb', display:'flex', gap:7, alignItems:'center' }}>
                        <input autoFocus value={linkSearch} onChange={e=>setLinkSearch(e.target.value)}
                          placeholder="Search tasks…"
                          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'5px 9px', fontSize:12, outline:'none' }}/>
                        <button onClick={()=>setShowLinkTask(false)}
                          style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:15 }}>✕</button>
                      </div>
                      <div style={{ maxHeight:200, overflowY:'auto', background:'white' }}>
                        {linkLoading ? (
                          <div style={{ padding:14, textAlign:'center', fontSize:12, color:'#9ca3af' }}>Loading…</div>
                        ) : (() => {
                          const ids = new Set(tasks.map((t:any)=>String(t.id)))
                          const q = linkSearch.toLowerCase()
                          const avail = (allTasks as any[]).filter(t=>
                            !ids.has(String(t.id)) &&
                            (!q || t.particulars?.toLowerCase().includes(q) || t.responsible?.toLowerCase().includes(q) || t.company?.toLowerCase().includes(q))
                          )
                          if (!avail.length) return (
                            <div style={{ padding:14, textAlign:'center', fontSize:12, color:'#9ca3af' }}>
                              {linkSearch ? 'No tasks match.' : 'All tasks linked.'}
                            </div>
                          )
                          return avail.slice(0,40).map((t:any)=>(
                            <div key={t.id} onClick={()=>linkTask(t.id)}
                              style={{ display:'flex', gap:7, padding:'7px 11px', cursor:'pointer', borderBottom:'1px solid #f9fafb', background:'white' }}
                              onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#f0fdf4'}
                              onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='white'}>
                              <div style={{ width:7, height:7, borderRadius:'50%', background:t.status==='resolved'?'#15803d':t.status==='action-required'?'#dc2626':'#d97706', flexShrink:0, marginTop:3 }}/>
                              <span style={{ flex:1, fontSize:12, color:'#111827' }}>{t.particulars}</span>
                              <span style={{ fontSize:10, color:'#9ca3af', whiteSpace:'nowrap' }}>{t.company} · {t.responsible}</span>
                            </div>
                          ))
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── BUDGET TAB ── */}
            {detailTab === 'budget' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto' }}>

                {/* Budget summary */}
                <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'16px 18px', marginBottom:20 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Budget Summary</div>
                    {canEdit && (
                      <button onClick={openEdit}
                        style={{ background:'none', border:'none', color:'#1a3a2a', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>
                        Edit budget ✏
                      </button>
                    )}
                  </div>
                  {active.budget > 0 ? (() => {
                    const pct = Math.min(100, Math.round((active.spent / active.budget) * 100))
                    const over = active.spent > active.budget
                    const warn = !over && pct >= 80
                    return (
                      <div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:14 }}>
                          {[
                            { label:'Allocated', val:`KES ${active.budget.toLocaleString()}`, color:'#374151' },
                            { label:'Spent', val:`KES ${active.spent.toLocaleString()}`, color: over?'#dc2626':warn?'#d97706':'#374151' },
                            { label: over?'Over by':'Remaining', val:`KES ${Math.abs(active.budget-active.spent).toLocaleString()}`, color: over?'#dc2626':warn?'#d97706':'#15803d' },
                          ].map(s=>(
                            <div key={s.label} style={{ textAlign:'center', padding:'10px', background:'white', borderRadius:6, border:'1px solid #e5e7eb' }}>
                              <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:3 }}>{s.label}</div>
                              <div style={{ fontSize:15, fontWeight:800, color:s.color }}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ height:8, background:'#e5e7eb', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: over?'#ef4444':warn?'#f59e0b':'#1a3a2a', borderRadius:4, transition:'width 0.3s' }}/>
                        </div>
                        <div style={{ fontSize:11, color:'#9ca3af', marginTop:5, textAlign:'right' }}>{pct}% of budget used</div>
                      </div>
                    )
                  })() : (
                    <div style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>
                      No budget set. <button onClick={openEdit} style={{ background:'none', border:'none', color:'#1a3a2a', fontWeight:600, cursor:'pointer', textDecoration:'underline', fontSize:13 }}>Set one in Edit Project.</button>
                    </div>
                  )}
                </div>

                {/* Petty Cash Requests linked to project */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:10 }}>
                    Petty Cash Requests {pcrs.length > 0 && `(${pcrs.length})`}
                  </div>
                  {!budgetLoaded && <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>Loading…</div>}
                  {budgetLoaded && pcrs.length === 0 && (
                    <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>
                      No petty cash requests linked. When submitting a PCR, select this project to track it here.
                    </div>
                  )}
                  {pcrs.length > 0 && (
                    <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                            {['Req No','Raised By','Date','Items','Amount','Status'].map(h=>(
                              <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(pcrs as any[]).map((r,i)=>{
                            const statusColor = PCR_STATUS_COLOR[r.status] || '#6b7280'
                            const items = Array.isArray(r.items) ? r.items : []
                            return (
                              <tr key={r.id} style={{ borderBottom: i<pcrs.length-1?'1px solid #f3f4f6':'none', background:'white' }}>
                                <td style={{ padding:'8px 10px', fontWeight:600, color:'#1a3a2a', whiteSpace:'nowrap' }}>{r.req_no || `#${r.id}`}</td>
                                <td style={{ padding:'8px 10px', color:'#374151', whiteSpace:'nowrap' }}>{r.employee_name}</td>
                                <td style={{ padding:'8px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>{r.request_date ? fmtDateShort(String(r.request_date).slice(0,10)) : '—'}</td>
                                <td style={{ padding:'8px 10px', color:'#6b7280', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                  {items.map((it:any)=>it.description).join(', ') || '—'}
                                </td>
                                <td style={{ padding:'8px 10px', fontWeight:600, color:'#111827', whiteSpace:'nowrap' }}>
                                  KES {Number(r.total_amount).toLocaleString()}
                                </td>
                                <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                                  <span style={{ color: statusColor, fontWeight:700, fontSize:11 }}>
                                    {PCR_STATUS_LABEL[r.status] || r.status}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#f9fafb', borderTop:'2px solid #e5e7eb' }}>
                            <td colSpan={4} style={{ padding:'8px 10px', fontSize:12, fontWeight:700, color:'#374151', textAlign:'right' }}>PCR Total (approved only)</td>
                            <td style={{ padding:'8px 10px', fontWeight:800, color:'#1a3a2a', fontSize:13 }}>
                              KES {(pcrs as any[]).filter(r=>r.status==='approved').reduce((s:number,r:any)=>s+Number(r.total_amount),0).toLocaleString()}
                            </td>
                            <td/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                  <div style={{ marginTop:8 }}>
                    <a href="/forms/petty-cash/new" style={{ fontSize:12, color:'#1a3a2a', fontWeight:600, textDecoration:'none' }}>
                      + Submit a petty cash request for this project →
                    </a>
                  </div>
                </div>

                {/* Manual Expenses */}
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>
                      Manual Expenses {expenses.length > 0 && `(${expenses.length})`}
                    </div>
                    {canEdit && !showAddExpense && (
                      <button onClick={()=>setShowAddExpense(true)}
                        style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                        + Log Expense
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize:12, color:'#9ca3af', marginBottom:10 }}>
                    For spend not in petty cash — bank transfers, invoices, supplier payments.
                  </div>

                  {/* Add expense form */}
                  {showAddExpense && (
                    <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:8, padding:'14px 16px', marginBottom:14 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                        <div style={{ gridColumn:'1/-1' }}>
                          <label style={lbl}>Description *</label>
                          <input value={expenseForm.description} onChange={e=>setExpenseForm(f=>({...f,description:e.target.value}))}
                            placeholder="e.g. Supplier payment — XYZ Ltd" autoFocus style={inp}/>
                        </div>
                        <div>
                          <label style={lbl}>Amount (KES) *</label>
                          <input type="number" min="0" step="0.01" value={expenseForm.amount}
                            onChange={e=>setExpenseForm(f=>({...f,amount:e.target.value}))}
                            placeholder="0.00" style={inp}/>
                        </div>
                        <div>
                          <label style={lbl}>Date</label>
                          <input type="date" value={expenseForm.expense_date}
                            onChange={e=>setExpenseForm(f=>({...f,expense_date:e.target.value}))} style={inp}/>
                        </div>
                        <div>
                          <label style={lbl}>Category</label>
                          <select value={expenseForm.category} onChange={e=>setExpenseForm(f=>({...f,category:e.target.value}))} style={inp}>
                            {EXPENSE_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                        <button onClick={()=>{ setShowAddExpense(false); setExpenseForm({...BLANK_EXPENSE}) }}
                          style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'7px 14px', borderRadius:6, fontSize:12, cursor:'pointer' }}>Cancel</button>
                        <button onClick={addExpense} disabled={!expenseForm.description.trim()||!expenseForm.amount||expenseSaving}
                          style={{ background:expenseForm.description.trim()&&expenseForm.amount?'#1a3a2a':'#9ca3af', color:'white', border:'none', padding:'7px 14px', borderRadius:6, fontSize:12, fontWeight:600, cursor:expenseForm.description.trim()&&expenseForm.amount?'pointer':'not-allowed' }}>
                          {expenseSaving?'Saving…':'Log Expense'}
                        </button>
                      </div>
                    </div>
                  )}

                  {budgetLoaded && expenses.length === 0 && !showAddExpense && (
                    <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>No manual expenses logged yet.</div>
                  )}

                  {expenses.length > 0 && (
                    <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                            {['Date','Description','Category','Amount','By',''].map(h=>(
                              <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {expenses.map((e,i)=>(
                            <tr key={e.id} style={{ borderBottom: i<expenses.length-1?'1px solid #f3f4f6':'none', background:'white' }}>
                              <td style={{ padding:'8px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>{fmtDateShort(e.expense_date)}</td>
                              <td style={{ padding:'8px 10px', color:'#111827', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.description}</td>
                              <td style={{ padding:'8px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>{e.category}</td>
                              <td style={{ padding:'8px 10px', fontWeight:600, color:'#111827', whiteSpace:'nowrap' }}>KES {e.amount.toLocaleString()}</td>
                              <td style={{ padding:'8px 10px', color:'#9ca3af', whiteSpace:'nowrap' }}>{e.logged_by}</td>
                              <td style={{ padding:'8px 10px' }}>
                                {canEdit && (
                                  <button onClick={()=>deleteExpense(e.id, e.amount)}
                                    style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:13 }}>✕</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#f9fafb', borderTop:'2px solid #e5e7eb' }}>
                            <td colSpan={3} style={{ padding:'8px 10px', fontSize:12, fontWeight:700, color:'#374151', textAlign:'right' }}>Manual Total</td>
                            <td style={{ padding:'8px 10px', fontWeight:800, color:'#1a3a2a', fontSize:13 }}>
                              KES {expenses.reduce((s,e)=>s+e.amount,0).toLocaleString()}
                            </td>
                            <td colSpan={2}/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {/* Grand total */}
                  {(pcrs.length > 0 || expenses.length > 0) && (
                    <div style={{ marginTop:14, padding:'12px 16px', background:'#1a3a2a', borderRadius:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'white' }}>Total Project Spend</span>
                      <span style={{ fontSize:16, fontWeight:800, color:'white' }}>KES {active.spent.toLocaleString()}</span>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* ── REPORTS TAB ── */}
            {detailTab === 'reports' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <div>
                    <div style={{ fontSize:14, fontWeight:700, color:'#111827' }}>Status Reports</div>
                    <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>Structured updates on progress, blockers, and next steps</div>
                  </div>
                  {canEdit && !showNewReport && (
                    <button onClick={()=>setShowNewReport(true)}
                      style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      + New Report
                    </button>
                  )}
                </div>

                {/* New report form */}
                {showNewReport && (
                  <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'16px 18px', marginBottom:18 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:14 }}>New Status Report</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                      <div>
                        <label style={lbl}>RAG Status for this period</label>
                        <div style={{ display:'flex', gap:8 }}>
                          {(['green','amber','red','not-set'] as RAGStatus[]).map(r=>(
                            <button key={r} onClick={()=>setReportForm(f=>({...f,rag:r}))}
                              style={{ display:'flex', alignItems:'center', gap:5, border:`2px solid ${reportForm.rag===r?RAG_CONFIG[r].color:'#e5e7eb'}`, background:reportForm.rag===r?RAG_CONFIG[r].bg:'white', borderRadius:6, padding:'5px 12px', cursor:'pointer', fontSize:12 }}>
                              <RAGDot status={r} size={8}/>
                              {RAG_CONFIG[r].label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label style={lbl}>Progress narrative *</label>
                        <textarea value={reportForm.narrative} onChange={e=>setReportForm(f=>({...f,narrative:e.target.value}))}
                          rows={3} placeholder="What was accomplished this period? Key progress made…"
                          style={{ ...inp, resize:'vertical' }}/>
                      </div>
                      <div>
                        <label style={lbl}>Blockers / Risks</label>
                        <textarea value={reportForm.blockers} onChange={e=>setReportForm(f=>({...f,blockers:e.target.value}))}
                          rows={2} placeholder="Any issues, risks, or blockers that could impact the project…"
                          style={{ ...inp, resize:'vertical' }}/>
                      </div>
                      <div>
                        <label style={lbl}>Next Steps</label>
                        <textarea value={reportForm.next_steps} onChange={e=>setReportForm(f=>({...f,next_steps:e.target.value}))}
                          rows={2} placeholder="What will be done next? Key actions planned…"
                          style={{ ...inp, resize:'vertical' }}/>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:14, justifyContent:'flex-end' }}>
                      <button onClick={()=>{ setShowNewReport(false); setReportForm({ ...BLANK_REPORT }) }}
                        style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'7px 14px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
                        Cancel
                      </button>
                      <button onClick={postReport} disabled={!reportForm.narrative.trim()||reportSaving}
                        style={{ background:reportForm.narrative.trim()?'#1a3a2a':'#9ca3af', color:'white', border:'none', padding:'7px 16px', borderRadius:6, fontSize:12, fontWeight:600, cursor:reportForm.narrative.trim()?'pointer':'not-allowed' }}>
                        {reportSaving?'Saving…':'Submit Report'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Reports list */}
                {reports.length === 0 && !showNewReport && (
                  <div style={{ textAlign:'center', color:'#9ca3af', paddingTop:40, fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>📊</div>
                    No status reports yet. Add one to track progress over time.
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {reports.map(r=>{
                    const cfg = RAG_CONFIG[r.rag]
                    return (
                      <div key={r.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden' }}>
                        <div style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb', padding:'10px 14px', display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}30`, borderRadius:5, padding:'2px 9px', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                            <RAGDot status={r.rag} size={8}/>
                            {cfg.label}
                          </div>
                          <span style={{ fontSize:12, fontWeight:600, color:'#374151' }}>{r.author}</span>
                          <span style={{ fontSize:11, color:'#9ca3af' }}>{fmtTs(r.created_at)}</span>
                          {(r.author === currentUser.name || canDelete) && (
                            <button onClick={()=>deleteReport(r.id)}
                              style={{ marginLeft:'auto', background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:13 }}>✕</button>
                          )}
                        </div>
                        <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                          <div>
                            <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>Progress</div>
                            <div style={{ fontSize:13, color:'#374151', lineHeight:1.55 }}>{r.narrative}</div>
                          </div>
                          {r.blockers && (
                            <div>
                              <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>Blockers / Risks</div>
                              <div style={{ fontSize:13, color:'#374151', lineHeight:1.55 }}>{r.blockers}</div>
                            </div>
                          )}
                          {r.next_steps && (
                            <div>
                              <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4 }}>Next Steps</div>
                              <div style={{ fontSize:13, color:'#374151', lineHeight:1.55 }}>{r.next_steps}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── THREAD TAB ── */}
            {detailTab === 'thread' && (
              <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
                <div style={{ flex:1, overflowY:'auto', padding:'14px 20px', display:'flex', flexDirection:'column', gap:9 }}>
                  {notes.length===0 && (
                    <div style={{ textAlign:'center', color:'#9ca3af', paddingTop:40, fontSize:13 }}>No messages yet. Start the conversation.</div>
                  )}
                  {notes.map(n=>{
                    const isMe = n.user_name===currentUser.name
                    return (
                      <div key={n.id} style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:7, alignItems:'flex-end' }}>
                        <div style={{ width:27, height:27, borderRadius:'50%', background:avatarColor(n.user_name), color:'white', fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          {avatarInitials(n.user_name)}
                        </div>
                        <div style={{ maxWidth:'70%' }}>
                          {!isMe && <div style={{ fontSize:11, fontWeight:700, color:'#374151', marginBottom:2, marginLeft:2 }}>{n.user_name}</div>}
                          <div style={{ padding:'8px 11px', borderRadius:isMe?'12px 12px 2px 12px':'12px 12px 12px 2px', background:isMe?'#1a3a2a':'#f3f4f6', color:isMe?'white':'#111827', fontSize:13, lineHeight:1.5 }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize:9, color:'#9ca3af', marginTop:2, textAlign:isMe?'right':'left' }}>
                            {new Date(n.created_at).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})} · {new Date(n.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}
                          </div>
                        </div>
                        {isMe && canEdit && (
                          <button onClick={()=>deleteNote(n.id)}
                            style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:11, padding:'0 2px', alignSelf:'flex-start', marginTop:4 }}>✕</button>
                        )}
                      </div>
                    )
                  })}
                  <div ref={threadBottomRef}/>
                </div>
                <div style={{ borderTop:'1px solid #e5e7eb', padding:'11px 18px', display:'flex', gap:7, flexShrink:0 }}>
                  <input value={noteDraft} onChange={e=>setNoteDraft(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();postNote()} }}
                    placeholder="Write a message…"
                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:8, padding:'7px 11px', fontSize:13, outline:'none' }}/>
                  <button onClick={postNote} disabled={!noteDraft.trim()||noteSaving}
                    style={{ background:noteDraft.trim()?'#1a3a2a':'#e5e7eb', color:noteDraft.trim()?'white':'#9ca3af', border:'none', borderRadius:8, padding:'7px 14px', fontSize:13, fontWeight:600, cursor:noteDraft.trim()?'pointer':'default' }}>
                    {noteSaving?'…':'Send'}
                  </button>
                </div>
              </div>
            )}

            {/* ── TIMELINE TAB ── */}
            {detailTab === 'timeline' && (() => {
              const today = new Date(); today.setHours(0,0,0,0)

              if (!active.start_date || !active.end_date) return (
                <div style={{ padding:60, textAlign:'center', color:'#9ca3af', fontSize:13, flex:1 }}>
                  <div style={{ fontSize:32, marginBottom:12 }}>📅</div>
                  Set a start and end date on this project to see the timeline.
                </div>
              )

              const startD    = new Date(active.start_date + 'T00:00:00')
              const endD      = new Date(active.end_date   + 'T00:00:00')
              const totalDays = (endD.getTime() - startD.getTime()) / 86400000

              const padMs      = Math.max(7 * 86400000, (endD.getTime() - startD.getTime()) * 0.03)
              const rangeStart = new Date(startD.getTime() - padMs)
              const rangeEnd   = new Date(endD.getTime()   + padMs)
              const totalMs    = rangeEnd.getTime() - rangeStart.getTime()

              function pct(d: Date) { return Math.max(0, Math.min(100, ((d.getTime()-rangeStart.getTime())/totalMs)*100)) }

              function buildTicks(): { label: string; p: number }[] {
                const out: { label: string; p: number }[] = []
                const cur = new Date(rangeStart)
                if (totalDays > 730) {
                  cur.setMonth(0); cur.setDate(1)
                  while (cur <= rangeEnd) { out.push({ label: String(cur.getFullYear()), p: pct(new Date(cur)) }); cur.setFullYear(cur.getFullYear()+1) }
                } else if (totalDays > 180) {
                  cur.setDate(1); cur.setMonth(Math.floor(cur.getMonth()/3)*3)
                  while (cur <= rangeEnd) { out.push({ label: `Q${Math.floor(cur.getMonth()/3)+1} ${cur.getFullYear()}`, p: pct(new Date(cur)) }); cur.setMonth(cur.getMonth()+3) }
                } else if (totalDays > 14) {
                  cur.setDate(1)
                  while (cur <= rangeEnd) { out.push({ label: cur.toLocaleDateString('en-GB',{month:'short',year:'2-digit'}), p: pct(new Date(cur)) }); cur.setMonth(cur.getMonth()+1) }
                } else {
                  cur.setDate(cur.getDate()-((cur.getDay()+6)%7))
                  while (cur <= rangeEnd) { out.push({ label: cur.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}), p: pct(new Date(cur)) }); cur.setDate(cur.getDate()+7) }
                }
                return out.filter(t=>t.p>=0&&t.p<=101)
              }

              const ticks    = buildTicks()
              const todayPct = pct(today)
              const barStart = pct(startD)
              const barEnd   = pct(endD)
              const barWidth = Math.max(barEnd-barStart, 0.4)
              const milestonesWithDates = active.milestones.filter(ms=>ms.due_date)
              const pxPerTick = totalDays>730 ? 110 : totalDays>180 ? 90 : 75
              const chartWidth = Math.max(640, ticks.length*pxPerTick)

              return (
                <div style={{ padding:'22px 26px', overflowX:'auto', flex:1 }}>
                  <div style={{ width: chartWidth }}>
                    <div style={{ position:'relative', height:30, borderBottom:'2px solid #e5e7eb' }}>
                      {ticks.map((t,i)=>(
                        <div key={i} style={{ position:'absolute', left:`${t.p}%`, top:0, bottom:0 }}>
                          <div style={{ width:1, height:6, background:'#d1d5db', marginTop:18 }}/>
                          <span style={{ position:'absolute', top:4, left:4, fontSize:11, fontWeight:600, color:'#6b7280', whiteSpace:'nowrap' }}>{t.label}</span>
                        </div>
                      ))}
                      {todayPct>0&&todayPct<100&&<div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:2, background:'#ef4444', zIndex:2 }}/>}
                    </div>
                    <div style={{ position:'relative' }}>
                      {ticks.map((t,i)=>(
                        <div key={i} style={{ position:'absolute', left:`${t.p}%`, top:0, bottom:0, width:1, background:'#f3f4f6', zIndex:0 }}/>
                      ))}
                      {todayPct>0&&todayPct<100&&(
                        <div style={{ position:'absolute', left:`${todayPct}%`, top:0, bottom:0, width:2, background:'#ef4444', zIndex:5 }}>
                          <div style={{ position:'absolute', top:12, left:5, background:'#ef4444', color:'white', fontSize:9, fontWeight:800, padding:'2px 5px', borderRadius:3, whiteSpace:'nowrap' }}>TODAY</div>
                        </div>
                      )}
                      <div style={{ position:'relative', height:58, display:'flex', alignItems:'center', borderBottom:'1px solid #f0f0f0' }}>
                        <div style={{ position:'absolute', left:`${barStart}%`, width:`${barWidth}%`, height:32, background:'linear-gradient(90deg,#1a3a2a,#2d6a4f)', borderRadius:7, boxShadow:'0 2px 10px rgba(26,58,42,0.22)', display:'flex', alignItems:'center', overflow:'hidden', zIndex:2, minWidth:6 }}>
                          <span style={{ fontSize:12, fontWeight:700, color:'white', paddingLeft:12, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{active.name}</span>
                        </div>
                        <div style={{ position:'absolute', left:`${barStart}%`, bottom:3, transform:'translateX(-50%)', fontSize:9, color:'#9ca3af', whiteSpace:'nowrap' }}>{fmtDate(active.start_date)}</div>
                        <div style={{ position:'absolute', left:`${barEnd}%`, bottom:3, transform:'translateX(-50%)', fontSize:9, color:'#9ca3af', whiteSpace:'nowrap' }}>{fmtDate(active.end_date)}</div>
                      </div>
                      {milestonesWithDates.map(ms=>{
                        const mp = pct(new Date(ms.due_date+'T00:00:00'))
                        const done = ms.status==='completed'
                        const flipRight = mp < 10
                        return (
                          <div key={ms.id} style={{ position:'relative', height:42, borderBottom:'1px solid #f9fafb' }}>
                            <div style={{ position:'absolute', left:0, right:0, top:'50%', height:1, background:'#f0f0f0' }}/>
                            <button
                              onClick={()=>canEdit&&toggleMilestone(ms)}
                              title={canEdit ? (done ? 'Click to mark Pending' : 'Click to mark Completed') : ms.status}
                              style={{ position:'absolute', left:`${mp}%`, top:'50%', transform:'translate(-50%,-50%) rotate(45deg)', width:17, height:17, background:done?'#15803d':'#b5833a', border:'2.5px solid white', boxShadow:`0 0 0 1.5px ${done?'#15803d':'#b5833a'}`, zIndex:3, cursor:canEdit?'pointer':'default', padding:0, outline:'none' }}
                            />
                            <div style={{ position:'absolute', top:4, ...(flipRight?{left:`${mp+1.5}%`}:{left:`${mp}%`,transform:'translateX(-50%)'}), fontSize:10, fontWeight:600, color:done?'#15803d':'#374151', whiteSpace:'nowrap', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', background:'white', border:`1px solid ${done?'#bbf7d0':'#e5e7eb'}`, borderRadius:4, padding:'2px 6px', zIndex:4, boxShadow:'0 1px 3px rgba(0,0,0,0.06)' }}>
                              {done&&'✓ '}{ms.title}
                            </div>
                          </div>
                        )
                      })}
                      {milestonesWithDates.length===0&&(
                        <div style={{ height:38, display:'flex', alignItems:'center', paddingLeft:6 }}>
                          <span style={{ fontSize:11, color:'#d1d5db' }}>No milestones with dates — add one in Overview.</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:11, color:'#6b7280', marginTop:16, paddingTop:12, borderTop:'1px solid #f3f4f6' }}>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:18, height:10, background:'linear-gradient(90deg,#1a3a2a,#2d6a4f)', borderRadius:3, display:'inline-block' }}/> Project duration</span>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:11, height:11, background:'#b5833a', display:'inline-block', transform:'rotate(45deg)' }}/> Pending</span>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:11, height:11, background:'#15803d', display:'inline-block', transform:'rotate(45deg)' }}/> Completed</span>
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}><span style={{ width:2, height:14, background:'#ef4444', display:'inline-block' }}/> Today</span>
                    </div>
                  </div>
                </div>
              )
            })()}

          </div>
        )}
      </div>

      {/* ── NEW PROJECT MODAL ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={()=>setShowForm(false)}>
          <div style={{ background:'white', borderRadius:12, padding:26, maxWidth:520, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>New Project</div>
              <button onClick={()=>setShowForm(false)} style={{ background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div><label style={lbl}>Project Name *</label><input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} autoFocus style={inp}/></div>
              <div><label style={lbl}>Description</label><textarea value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                <div><label style={lbl}>Company *</label><select value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} style={inp}>{[...COMPANIES].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={lbl}>Owner</label><select value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))} style={inp}><option value="">—</option>{[...PEOPLE].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                <div><label style={lbl}>Start Date</label><input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>End Date</label><input type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))} style={inp}/></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                <div><label style={lbl}>Budget (KES)</label><input type="number" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} placeholder="0" style={inp}/></div>
                <div><label style={lbl}>Initial Status</label><select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value as ProjectStatus}))} style={inp}>{(Object.keys(PROJECT_STATUS_LABELS) as ProjectStatus[]).map(s=><option key={s} value={s}>{PROJECT_STATUS_LABELS[s]}</option>)}</select></div>
              </div>
            </div>
            <div style={{ display:'flex', gap:9, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowForm(false)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={createProject} disabled={saving||!form.name.trim()} style={{ background:saving||!form.name.trim()?'#9ca3af':'#1a3a2a', color:'white', border:'none', padding:'8px 20px', borderRadius:6, fontSize:13, fontWeight:600, cursor:saving||!form.name.trim()?'not-allowed':'pointer' }}>
                {saving?'Creating…':'Create Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PROJECT MODAL ── */}
      {showEdit && active && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={()=>setShowEdit(false)}>
          <div style={{ background:'white', borderRadius:12, padding:26, maxWidth:520, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:700 }}>Edit Project</div>
              <button onClick={()=>setShowEdit(false)} style={{ background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div><label style={lbl}>Project Name *</label><input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))} autoFocus style={inp}/></div>
              <div><label style={lbl}>Description</label><textarea value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }}/></div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                <div><label style={lbl}>Company</label><select value={editForm.company} onChange={e=>setEditForm(f=>({...f,company:e.target.value}))} style={inp}>{[...COMPANIES].map(c=><option key={c} value={c}>{c}</option>)}</select></div>
                <div><label style={lbl}>Owner</label><select value={editForm.owner} onChange={e=>setEditForm(f=>({...f,owner:e.target.value}))} style={inp}><option value="">—</option>{[...PEOPLE].map(p=><option key={p} value={p}>{p}</option>)}</select></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                <div><label style={lbl}>Start Date</label><input type="date" value={editForm.start_date} onChange={e=>setEditForm(f=>({...f,start_date:e.target.value}))} style={inp}/></div>
                <div><label style={lbl}>End Date</label><input type="date" value={editForm.end_date} onChange={e=>setEditForm(f=>({...f,end_date:e.target.value}))} style={inp}/></div>
              </div>
              <div><label style={lbl}>Budget (KES)</label><input type="number" value={editForm.budget} onChange={e=>setEditForm(f=>({...f,budget:e.target.value}))} placeholder="0" style={inp}/></div>
            </div>
            <div style={{ display:'flex', gap:9, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowEdit(false)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveEdit} disabled={editSaving||!editForm.name.trim()} style={{ background:editSaving||!editForm.name.trim()?'#9ca3af':'#1a3a2a', color:'white', border:'none', padding:'8px 20px', borderRadius:6, fontSize:13, fontWeight:600, cursor:editSaving||!editForm.name.trim()?'not-allowed':'pointer' }}>
                {editSaving?'Saving…':'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE TASK MODAL ── */}
      {showCreateTask && active && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={()=>setShowCreateTask(false)}>
          <div style={{ background:'white', borderRadius:12, padding:26, maxWidth:480, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700 }}>New Task</div>
                <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Will be linked to <strong>{active.name}</strong></div>
              </div>
              <button onClick={()=>setShowCreateTask(false)} style={{ background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer' }}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:13 }}>
              <div>
                <label style={lbl}>Task Description *</label>
                <textarea value={createTaskForm.particulars} onChange={e=>setCreateTaskForm(f=>({...f,particulars:e.target.value}))}
                  rows={3} placeholder="Describe the task clearly…" autoFocus
                  style={{ ...inp, resize:'vertical' }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                <div>
                  <label style={lbl}>Responsible</label>
                  <select value={createTaskForm.responsible} onChange={e=>setCreateTaskForm(f=>({...f,responsible:e.target.value}))} style={inp}>
                    <option value="">Select person…</option>
                    {[...PEOPLE].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select value={createTaskForm.priority} onChange={e=>setCreateTaskForm(f=>({...f,priority:e.target.value}))} style={inp}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Due Date</label>
                <input type="date" value={createTaskForm.due_date} onChange={e=>setCreateTaskForm(f=>({...f,due_date:e.target.value}))} style={inp}/>
              </div>
              <div style={{ background:'#f3f4f6', borderRadius:6, padding:'8px 11px', fontSize:11, color:'#6b7280' }}>
                Company: <strong>{active.company}</strong> · Status: <strong>Action Required</strong>
              </div>
            </div>
            <div style={{ display:'flex', gap:9, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={()=>setShowCreateTask(false)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={submitCreateTask} disabled={createTaskSaving||!createTaskForm.particulars.trim()} style={{ background:createTaskSaving||!createTaskForm.particulars.trim()?'#9ca3af':'#b5833a', color:'white', border:'none', padding:'8px 20px', borderRadius:6, fontSize:13, fontWeight:600, cursor:createTaskSaving||!createTaskForm.particulars.trim()?'not-allowed':'pointer' }}>
                {createTaskSaving?'Creating…':'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
