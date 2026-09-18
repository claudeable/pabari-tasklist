'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Project, Milestone, ProjectStatus, RAGStatus, ProjectMember, StatusReport, ProjectExpense, SessionUser,
  PROJECT_STATUS_LABELS, PROJECT_STATUS_STYLE, COMPANIES, PEOPLE,
  InvoiceStatus, INVOICE_STATUS_STYLE, INVOICE_STATUS_LABELS,
  ProjectUpdate, ProjectUpdateComment, ProjectMeeting, MeetingActionTask, UpdateType, UpdateStatus,
  ProjectDecision, ProjectRisk, DecisionStatus, RiskType, RiskSeverity, RiskStatus,
  ProjectActivity,
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
const BLANK_UPDATE  = { type:'general' as UpdateType, title:'', body:'', owner:'', next_steps:'' }
const BLANK_MEETING = { title:'', meeting_date: new Date().toISOString().slice(0,10), attendees:'', agenda:'', notes:'', action_points:'' }

const UPDATE_TYPE_CONFIG: Record<UpdateType, { label:string; bg:string; color:string }> = {
  progress:  { label:'Progress',  bg:'#dbeafe', color:'#1d4ed8' },
  action:    { label:'Action',    bg:'#fef3c7', color:'#b45309' },
  decision:  { label:'Decision',  bg:'#ede9fe', color:'#7c3aed' },
  blocker:   { label:'Blocker',   bg:'#fee2e2', color:'#dc2626' },
  general:   { label:'General',   bg:'#f3f4f6', color:'#6b7280' },
}
const UPDATE_STATUS_CONFIG: Record<UpdateStatus, { label:string; bg:string; color:string }> = {
  open:        { label:'Open',        bg:'#dbeafe', color:'#1d4ed8' },
  in_progress: { label:'In Progress', bg:'#fef3c7', color:'#b45309' },
  done:        { label:'Done',        bg:'#dcfce7', color:'#15803d' },
}

const EXPENSE_CATEGORIES = ['General','Materials','Labour','Transport','Equipment','Utilities','Professional Fees','Other']

const BLANK_DECISION = { title:'', description:'', status:'pending' as DecisionStatus, owner:'', decision_date:'', source:'' }
const BLANK_RISK     = { type:'risk' as RiskType, title:'', description:'', owner:'', severity:'medium' as RiskSeverity, mitigation:'', target_date:'' }

const DECISION_STATUS_CONFIG: Record<DecisionStatus, { label:string; bg:string; color:string }> = {
  pending:   { label:'Pending',   bg:'#fef3c7', color:'#b45309' },
  decided:   { label:'Decided',   bg:'#dcfce7', color:'#15803d' },
  deferred:  { label:'Deferred',  bg:'#ede9fe', color:'#7c3aed' },
  rejected:  { label:'Rejected',  bg:'#fee2e2', color:'#dc2626' },
}

const RISK_SEVERITY_CONFIG: Record<RiskSeverity, { label:string; bg:string; color:string }> = {
  low:      { label:'Low',      bg:'#f0fdf4', color:'#15803d' },
  medium:   { label:'Medium',   bg:'#fef3c7', color:'#b45309' },
  high:     { label:'High',     bg:'#fff7ed', color:'#c2410c' },
  critical: { label:'Critical', bg:'#fee2e2', color:'#dc2626' },
}

const RISK_STATUS_CONFIG: Record<RiskStatus, { label:string; bg:string; color:string }> = {
  open:        { label:'Open',        bg:'#fee2e2', color:'#dc2626' },
  in_progress: { label:'In Progress', bg:'#fef3c7', color:'#b45309' },
  resolved:    { label:'Resolved',    bg:'#dcfce7', color:'#15803d' },
  closed:      { label:'Closed',      bg:'#f3f4f6', color:'#6b7280' },
}

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

const MS_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d']

function GanttChart({ milestones, projectStart, projectEnd }: { milestones: Milestone[]; projectStart: string; projectEnd: string }) {
  const s0 = projectStart ? new Date(projectStart + 'T00:00:00').getTime() : Date.now() - 30 * 86400000
  const e0 = projectEnd   ? new Date(projectEnd   + 'T00:00:00').getTime() : Date.now() + 90 * 86400000
  const span = Math.max(e0 - s0, 1)
  const todayPct = Math.max(0, Math.min(100, ((Date.now() - s0) / span) * 100))

  if (!milestones.length) return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      No milestones yet — add milestones with start &amp; end dates to see the Gantt.
    </div>
  )
  const withDates = milestones.filter(m => m.start_date || m.due_date)
  if (!withDates.length) return (
    <div style={{ padding: '40px 24px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      Milestones need a start date to appear on the Gantt.
    </div>
  )

  const months: string[] = []
  let cur = new Date(s0); cur.setDate(1)
  const end = new Date(e0)
  while (cur <= end) {
    months.push(cur.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }))
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  return (
    <div style={{ overflowX: 'auto', padding: '16px 0' }}>
      <div style={{ minWidth: 600, position: 'relative' }}>
        <div style={{ display: 'flex', marginBottom: 8, paddingLeft: 172 }}>
          {months.map((m, i) => (
            <div key={i} style={{ flex: 1, fontSize: 10, color: '#9ca3af', fontWeight: 700, whiteSpace: 'nowrap' }}>{m}</div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: `calc(172px + ${todayPct / 100} * (100% - 172px))`, top: 24, bottom: 0, width: 2, background: '#ef4444', zIndex: 2, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -16, left: -14, fontSize: 9, fontWeight: 800, color: '#ef4444', background: '#fee2e2', padding: '2px 5px', borderRadius: 4, whiteSpace: 'nowrap' }}>TODAY</div>
        </div>
        {milestones.map(ms => {
          const msStart = ms.start_date ? new Date(ms.start_date + 'T00:00:00').getTime() : (ms.due_date ? new Date(ms.due_date + 'T00:00:00').getTime() - 7 * 86400000 : s0)
          const msEnd   = ms.due_date   ? new Date(ms.due_date   + 'T00:00:00').getTime() : msStart + 7 * 86400000
          const left    = Math.max(0, ((msStart - s0) / span) * 100)
          const width   = Math.max(0.5, ((msEnd - msStart) / span) * 100)
          const done    = ms.status === 'completed'
          const barColor = done ? '#16a34a' : (ms.color || '#2563eb')
          return (
            <div key={ms.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ width: 164, flexShrink: 0, paddingRight: 8 }}>
                <div style={{ fontSize: 12, color: '#374151', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ms.title}>{ms.title}</div>
                {ms.amount > 0 && <div style={{ fontSize: 10, color: '#6b7280' }}>KES {ms.amount.toLocaleString()}</div>}
              </div>
              <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 26, position: 'relative' }}>
                <div style={{ position: 'absolute', left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, height: '100%', background: barColor, borderRadius: 4, opacity: done ? 1 : 0.85, display: 'flex', alignItems: 'center', paddingLeft: 6, minWidth: 4 }}>
                  <span style={{ fontSize: 9, color: 'white', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {done ? '✓ ' : ''}{ms.start_date ? ms.start_date.slice(5) : ''}{ms.start_date && ms.due_date ? ' – ' : ''}{ms.due_date ? ms.due_date.slice(5) : ''}
                  </span>
                </div>
              </div>
              <div style={{ width: 70, flexShrink: 0, paddingLeft: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, background: done ? '#dcfce7' : ms.status === 'in_progress' ? '#fef3c7' : '#f3f4f6', color: done ? '#15803d' : ms.status === 'in_progress' ? '#b45309' : '#6b7280', borderRadius: 10, padding: '2px 7px' }}>
                  {done ? 'Done' : ms.status === 'in_progress' ? 'Active' : 'Pending'}
                </span>
              </div>
            </div>
          )
        })}
        {milestones.some(m => m.amount > 0) && (
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e5e7eb', paddingLeft: 172, fontSize: 12, color: '#374151' }}>
            <span style={{ fontWeight: 700 }}>Total Investment: </span>
            KES {milestones.reduce((s, m) => s + (m.amount || 0), 0).toLocaleString()}
            {' · '}{milestones.filter(m => m.status === 'completed').length}/{milestones.length} phases complete
          </div>
        )}
      </div>
    </div>
  )
}

function parseDate(d: string): Date {
  if (!d) return new Date('invalid')
  // Already a full ISO timestamp — parse directly
  if (d.length > 10) return new Date(d)
  // YYYY-MM-DD — append time to avoid UTC midnight offset
  return new Date(d + 'T00:00:00')
}

function fmtDate(d: string) {
  if (!d) return '—'
  const dt = parseDate(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function fmtDateShort(d: string) {
  if (!d) return '—'
  const dt = parseDate(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
}

function fmtTs(ts: string) {
  const d = new Date(ts)
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) +
    ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
}

function daysLeft(d: string): number {
  if (!d) return Infinity
  const today = new Date(); today.setHours(0,0,0,0)
  const dt = parseDate(d)
  if (isNaN(dt.getTime())) return Infinity
  return Math.ceil((dt.getTime() - today.getTime()) / 86400000)
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
  const [detailTab, setDetailTab] = useState<'overview'|'reports'|'thread'|'timeline'|'budget'|'updates'|'meetings'|'decisions'|'risks'|'activity'|'gantt'>('overview')

  // Milestones
  const [msTitle,       setMsTitle]       = useState('')
  const [msDate,        setMsDate]        = useState('')
  const [msStartDate,   setMsStartDate]   = useState('')
  const [msColor,       setMsColor]       = useState('#2563eb')
  const [msAmount,      setMsAmount]      = useState('')
  const [msAdding,      setMsAdding]      = useState(false)
  const [editingMsId,      setEditingMsId]      = useState<number|null>(null)
  const [editingMsTitle,   setEditingMsTitle]   = useState('')
  const [editingMsDate,    setEditingMsDate]     = useState('')
  const [editingMsStartDate, setEditingMsStartDate] = useState('')
  const [editingMsColor,   setEditingMsColor]   = useState('#2563eb')
  const [editingMsAmount,  setEditingMsAmount]  = useState('')
  const [msSaving,      setMsSaving]      = useState(false)

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

  // Task detail / remarks
  const [expandedTaskId, setExpandedTaskId] = useState<string|null>(null)
  const [remarkText,     setRemarkText]     = useState('')
  const [remarkSaving,   setRemarkSaving]   = useState(false)

  // Budget / Expenses / PCRs / LPOs
  const [expenses,       setExpenses]       = useState<ProjectExpense[]>([])
  const [pcrs,           setPcrs]           = useState<Record<string,unknown>[]>([])
  const [lpos,           setLpos]           = useState<Record<string,unknown>[]>([])
  const [budgetLoaded,   setBudgetLoaded]   = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [expenseForm,    setExpenseForm]    = useState({ ...BLANK_EXPENSE })
  const [expenseSaving,  setExpenseSaving]  = useState(false)

  // Updates
  const [updates,       setUpdates]       = useState<ProjectUpdate[]>([])
  const [updatesLoaded, setUpdatesLoaded] = useState(false)
  const [showNewUpdate, setShowNewUpdate] = useState(false)
  const [updateForm,    setUpdateForm]    = useState({ ...BLANK_UPDATE })
  const [updateSaving,  setUpdateSaving]  = useState(false)
  const [expandedUpdate, setExpandedUpdate] = useState<number|null>(null)
  const [commentDraft,  setCommentDraft]  = useState<Record<number,string>>({})
  const [commentSaving, setCommentSaving] = useState<Record<number,boolean>>({})

  // Meetings
  const [meetings,       setMeetings]       = useState<ProjectMeeting[]>([])
  const [meetingsLoaded, setMeetingsLoaded] = useState(false)
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [meetingForm,    setMeetingForm]    = useState({ ...BLANK_MEETING })
  const [meetingSaving,  setMeetingSaving]  = useState(false)
  const [expandedMeeting, setExpandedMeeting] = useState<number|null>(null)

  // Convert action point to task
  const [convertModal, setConvertModal] = useState<{
    meetingId: number; actionText: string; company: string
  } | null>(null)
  const [convertForm, setConvertForm] = useState<{ particulars:string; responsible:string; due_date:string; priority:'low'|'medium'|'high' }>({ particulars:'', responsible:'', due_date:'', priority:'medium' })
  const [convertSaving, setConvertSaving] = useState(false)
  const [convertError,  setConvertError]  = useState('')

  // Decisions
  const [decisions,       setDecisions]       = useState<ProjectDecision[]>([])
  const [decisionsLoaded, setDecisionsLoaded] = useState(false)
  const [showNewDecision, setShowNewDecision] = useState(false)
  const [decisionForm,    setDecisionForm]    = useState({ ...BLANK_DECISION })
  const [decisionSaving,  setDecisionSaving]  = useState(false)
  const [editingDecision, setEditingDecision] = useState<ProjectDecision|null>(null)
  const [editDecisionForm, setEditDecisionForm] = useState({ ...BLANK_DECISION })
  const [editDecisionSaving, setEditDecisionSaving] = useState(false)

  // Risks & Issues
  const [risks,       setRisks]       = useState<ProjectRisk[]>([])
  const [risksLoaded, setRisksLoaded] = useState(false)
  const [showNewRisk, setShowNewRisk] = useState(false)
  const [riskForm,    setRiskForm]    = useState({ ...BLANK_RISK })
  const [riskSaving,  setRiskSaving]  = useState(false)
  const [editingRisk, setEditingRisk] = useState<ProjectRisk|null>(null)
  const [editRiskForm, setEditRiskForm] = useState({ ...BLANK_RISK })
  const [editRiskSaving, setEditRiskSaving] = useState(false)

  // Activity
  const [activityFeed,   setActivityFeed]   = useState<ProjectActivity[]>([])
  const [activityLoaded, setActivityLoaded] = useState(false)

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

  // ── Load updates when tab opens ──
  useEffect(() => {
    if (detailTab !== 'updates' || !active || updatesLoaded) return
    fetch(`/api/projects/${active.id}/updates`, { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setUpdates(Array.isArray(data) ? data : []); setUpdatesLoaded(true) })
      .catch(() => {})
  }, [detailTab, active?.id, updatesLoaded])

  // ── Load meetings when tab opens ──
  useEffect(() => {
    if (detailTab !== 'meetings' || !active || meetingsLoaded) return
    fetch(`/api/projects/${active.id}/meetings`, { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setMeetings(Array.isArray(data) ? data : []); setMeetingsLoaded(true) })
      .catch(() => {})
  }, [detailTab, active?.id, meetingsLoaded])

  // ── Load decisions when tab opens ──
  useEffect(() => {
    if (detailTab !== 'decisions' || !active || decisionsLoaded) return
    fetch(`/api/projects/${active.id}/decisions`, { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setDecisions(Array.isArray(data) ? data : []); setDecisionsLoaded(true) })
      .catch(() => {})
  }, [detailTab, active?.id, decisionsLoaded])

  // ── Load risks when tab opens ──
  useEffect(() => {
    if (detailTab !== 'risks' || !active || risksLoaded) return
    fetch(`/api/projects/${active.id}/risks`, { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setRisks(Array.isArray(data) ? data : []); setRisksLoaded(true) })
      .catch(() => {})
  }, [detailTab, active?.id, risksLoaded])

  // ── Load full activity when tab opens ──
  useEffect(() => {
    if (detailTab !== 'activity' || !active || activityLoaded) return
    fetch(`/api/projects/${active.id}/activity?limit=100`, { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setActivityFeed(Array.isArray(data) ? data : []); setActivityLoaded(true) })
      .catch(() => {})
  }, [detailTab, active?.id, activityLoaded])

  // ── Load budget when tab opens ──
  useEffect(() => {
    if (detailTab !== 'budget' || !active || budgetLoaded) return
    fetch(`/api/projects/${active.id}/budget`, { credentials:'include' })
      .then(r => r.ok ? r.json() : { expenses:[], pcrs:[], lpos:[] })
      .then(data => {
        setExpenses(Array.isArray(data.expenses) ? data.expenses : [])
        setPcrs(Array.isArray(data.pcrs) ? data.pcrs : [])
        setLpos(Array.isArray(data.lpos) ? data.lpos : [])
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
    setExpenses([]); setPcrs([]); setLpos([]); setBudgetLoaded(false)
    setUpdates([]); setUpdatesLoaded(false); setShowNewUpdate(false); setExpandedUpdate(null)
    setMeetings([]); setMeetingsLoaded(false); setShowNewMeeting(false); setExpandedMeeting(null)
    setDecisions([]); setDecisionsLoaded(false); setShowNewDecision(false); setEditingDecision(null)
    setRisks([]); setRisksLoaded(false); setShowNewRisk(false); setEditingRisk(null)
    setActivityFeed([]); setActivityLoaded(false)
    setShowLinkTask(false); setTaskFilter('all')

    const [res, notesRes, membersRes, decisionsRes, risksRes, activityRes] = await Promise.all([
      fetch(`/api/projects/${p.id}`, { credentials:'include' }),
      fetch(`/api/projects/${p.id}/notes`, { credentials:'include' }),
      fetch(`/api/projects/${p.id}/members`, { credentials:'include' }),
      fetch(`/api/projects/${p.id}/decisions`, { credentials:'include' }),
      fetch(`/api/projects/${p.id}/risks`, { credentials:'include' }),
      fetch(`/api/projects/${p.id}/activity?limit=10`, { credentials:'include' }),
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
    if (decisionsRes.ok) {
      const d = await decisionsRes.json()
      setDecisions(Array.isArray(d) ? d : [])
    }
    setDecisionsLoaded(true)
    if (risksRes.ok) {
      const d = await risksRes.json()
      setRisks(Array.isArray(d) ? d : [])
    }
    setRisksLoaded(true)
    if (activityRes.ok) {
      const d = await activityRes.json()
      setActivityFeed(Array.isArray(d) ? d : [])
    }
    setActivityLoaded(true)
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

  // ── Update CRUD ──
  async function postUpdate() {
    if (!updateForm.title.trim() || !active) return
    setUpdateSaving(true)
    const res = await fetch(`/api/projects/${active.id}/updates`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ ...updateForm }),
    })
    if (res.ok) {
      const u: ProjectUpdate = await res.json()
      setUpdates(prev => [u, ...prev])
      setShowNewUpdate(false)
      setUpdateForm({ ...BLANK_UPDATE })
    }
    setUpdateSaving(false)
  }

  async function patchUpdateStatus(u: ProjectUpdate, status: UpdateStatus) {
    const res = await fetch(`/api/projects/${active!.id}/updates/${u.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated: ProjectUpdate = await res.json()
      setUpdates(prev => prev.map(x => x.id === updated.id ? { ...updated, comments: x.comments } : x))
    }
  }

  async function deleteUpdate(uid: number) {
    if (!confirm('Delete this update?') || !active) return
    await fetch(`/api/projects/${active.id}/updates/${uid}`, { method:'DELETE', credentials:'include' })
    setUpdates(prev => prev.filter(u => u.id !== uid))
  }

  async function postUpdateComment(updateId: number) {
    const msg = (commentDraft[updateId] || '').trim()
    if (!msg || !active) return
    setCommentSaving(p => ({ ...p, [updateId]: true }))
    const res = await fetch(`/api/projects/${active.id}/updates/${updateId}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ message: msg }),
    })
    if (res.ok) {
      const c: ProjectUpdateComment = await res.json()
      setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, comments: [...u.comments, c] } : u))
      setCommentDraft(p => ({ ...p, [updateId]: '' }))
    }
    setCommentSaving(p => ({ ...p, [updateId]: false }))
  }

  // ── Meeting CRUD ──
  async function postMeeting() {
    if (!meetingForm.title.trim() || !active) return
    setMeetingSaving(true)
    const res = await fetch(`/api/projects/${active.id}/meetings`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ ...meetingForm }),
    })
    if (res.ok) {
      const m: ProjectMeeting = await res.json()
      setMeetings(prev => [m, ...prev])
      setShowNewMeeting(false)
      setMeetingForm({ ...BLANK_MEETING })
    }
    setMeetingSaving(false)
  }

  async function deleteMeeting(mid: number) {
    if (!confirm('Delete this meeting record?') || !active) return
    await fetch(`/api/projects/${active.id}/meetings/${mid}`, { method:'DELETE', credentials:'include' })
    setMeetings(prev => prev.filter(m => m.id !== mid))
  }

  async function submitConvertToTask() {
    if (!convertModal || !active || !convertForm.particulars.trim()) return
    setConvertSaving(true)
    setConvertError('')
    const res = await fetch(`/api/projects/${active.id}/meetings/${convertModal.meetingId}/action-tasks`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({
        action_text:  convertModal.actionText,
        particulars:  convertForm.particulars.trim(),
        responsible:  convertForm.responsible,
        due_date:     convertForm.due_date,
        priority:     convertForm.priority,
        company:      convertModal.company,
      }),
    })
    if (res.status === 409) {
      setConvertError('This action point already has a task.')
    } else if (res.ok) {
      const { link } = await res.json() as { task: Record<string,unknown>; link: MeetingActionTask }
      // Update the local meeting to show the badge immediately
      setMeetings(prev => prev.map(m => {
        if (m.id !== convertModal.meetingId) return m
        const existing = m.action_tasks || []
        return { ...m, action_tasks: [...existing, link] }
      }))
      setConvertModal(null)
      setConvertForm({ particulars:'', responsible:'', due_date:'', priority:'medium' })
    } else {
      const d = await res.json().catch(() => ({}))
      setConvertError((d as Record<string,string>).error || 'Failed to create task.')
    }
    setConvertSaving(false)
  }

  // ── Decision CRUD ──
  async function postDecision() {
    if (!decisionForm.title.trim() || !active) return
    setDecisionSaving(true)
    const res = await fetch(`/api/projects/${active.id}/decisions`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ ...decisionForm }),
    })
    if (res.ok) {
      const d: ProjectDecision = await res.json()
      setDecisions(prev => [d, ...prev])
      setShowNewDecision(false)
      setDecisionForm({ ...BLANK_DECISION })
    }
    setDecisionSaving(false)
  }

  async function saveDecision() {
    if (!editingDecision || !active) return
    setEditDecisionSaving(true)
    const res = await fetch(`/api/projects/${active.id}/decisions/${editingDecision.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ ...editDecisionForm }),
    })
    if (res.ok) {
      const d: ProjectDecision = await res.json()
      setDecisions(prev => prev.map(x => x.id === d.id ? d : x))
      setEditingDecision(null)
    }
    setEditDecisionSaving(false)
  }

  async function deleteDecision(did: number) {
    if (!confirm('Delete this decision?') || !active) return
    await fetch(`/api/projects/${active.id}/decisions/${did}`, { method:'DELETE', credentials:'include' })
    setDecisions(prev => prev.filter(d => d.id !== did))
  }

  // ── Risk CRUD ──
  async function postRisk() {
    if (!riskForm.title.trim() || !active) return
    setRiskSaving(true)
    const res = await fetch(`/api/projects/${active.id}/risks`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ ...riskForm }),
    })
    if (res.ok) {
      const r: ProjectRisk = await res.json()
      setRisks(prev => [r, ...prev])
      setShowNewRisk(false)
      setRiskForm({ ...BLANK_RISK })
    }
    setRiskSaving(false)
  }

  async function saveRisk() {
    if (!editingRisk || !active) return
    setEditRiskSaving(true)
    const res = await fetch(`/api/projects/${active.id}/risks/${editingRisk.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ ...editRiskForm }),
    })
    if (res.ok) {
      const r: ProjectRisk = await res.json()
      setRisks(prev => prev.map(x => x.id === r.id ? r : x))
      setEditingRisk(null)
    }
    setEditRiskSaving(false)
  }

  async function deleteRisk(rid: number) {
    if (!confirm('Delete this risk/issue?') || !active) return
    await fetch(`/api/projects/${active.id}/risks/${rid}`, { method:'DELETE', credentials:'include' })
    setRisks(prev => prev.filter(r => r.id !== rid))
  }

  async function patchRiskStatus(r: ProjectRisk, status: RiskStatus) {
    const res = await fetch(`/api/projects/${active!.id}/risks/${r.id}`, {
      method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated: ProjectRisk = await res.json()
      setRisks(prev => prev.map(x => x.id === updated.id ? updated : x))
    }
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
      body: JSON.stringify({ add_milestone: true, title: msTitle.trim(), due_date: msDate, start_date: msStartDate, color: msColor, amount: Number(msAmount) || 0 }),
    })
    if (res.ok) {
      const ms: Milestone = await res.json()
      const updated = { ...active, milestones: [...active.milestones, ms] }
      setActive(updated)
      setProjects(prev => prev.map(p => p.id === updated.id ? updated : p))
      setMsTitle(''); setMsDate(''); setMsStartDate(''); setMsColor('#2563eb'); setMsAmount('')
    }
    setMsAdding(false)
  }

  function syncMilestones(projectId: number, newMs: Milestone[]) {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, milestones: newMs } : p))
  }

  async function setMilestoneStatus(ms: Milestone, newStatus: 'pending' | 'in_progress' | 'completed') {
    if (!active) return
    const pid = active.id
    const res = await fetch(`/api/milestones/${ms.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      const updated: Milestone = await res.json()
      setActive(a => {
        if (!a) return a
        const newMs = a.milestones.map(m => m.id === updated.id ? updated : m)
        syncMilestones(pid, newMs)
        return { ...a, milestones: newMs }
      })
    } else {
      const err = await res.json().catch(()=>({}))
      alert('Failed to update milestone: ' + (err.error || res.status))
    }
  }

  async function saveMilestoneEdit(ms: Milestone) {
    if (!active || msSaving) return
    setMsSaving(true)
    const res = await fetch(`/api/milestones/${ms.id}`, {
      method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ title: editingMsTitle.trim() || ms.title, due_date: editingMsDate, start_date: editingMsStartDate, color: editingMsColor, amount: Number(editingMsAmount) || 0 }),
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

  async function addRemark(taskId: string) {
    const text = remarkText.trim()
    if (!text || remarkSaving) return
    setRemarkSaving(true)
    const today = new Date()
    const dateStr = `${today.getDate()}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][today.getMonth()]}-${String(today.getFullYear()).slice(2)}`
    const res = await fetch(`/api/tasks/${taskId}/updates`, {
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
      body: JSON.stringify({ text, date: dateStr }),
    })
    if (res.ok) {
      const { update } = await res.json()
      setTasks(prev => prev.map(t =>
        String(t.id) === taskId
          ? { ...t, task_updates: [update, ...((t.task_updates as unknown[]) || [])] }
          : t
      ))
      setRemarkText('')
    }
    setRemarkSaving(false)
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
              <button onClick={()=>setViewMode('list')}
                style={{ background: viewMode==='list' ? '#1a3a2a' : '#f3f4f6', color: viewMode==='list' ? 'white' : '#6b7280', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                ≡ List
              </button>
              <button onClick={()=>{ setViewMode('portfolio'); setActive(null) }}
                style={{ background: viewMode==='portfolio' ? '#1a3a2a' : '#f3f4f6', color: viewMode==='portfolio' ? 'white' : '#6b7280', border:'none', borderRadius:4, padding:'4px 10px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                ⊞ Portfolio
              </button>
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
                { key:'overview',   label:'📋 Overview' },
                { key:'budget',     label:'💰 Budget' },
                { key:'updates',    label:'📝 Updates' },
                { key:'meetings',   label:'🗓 Meetings' },
                { key:'decisions',  label:'⚖️ Decisions' },
                { key:'risks',      label:'⚠️ Risks & Issues' },
                { key:'activity',   label:'🕐 Activity' },
                { key:'gantt',      label:'📊 Gantt' },
                { key:'reports',    label:'📊 Reports' },
                { key:'thread',     label:'💬 Thread' },
                { key:'timeline',   label:'📅 Timeline' },
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
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {active.milestones.map(ms=>{
                      const dl = daysLeft(ms.due_date)
                      const done = ms.status==='completed'
                      const overdue = !done && ms.due_date && dl < 0
                      const isEditing = editingMsId === ms.id
                      return (
                        <div key={ms.id} style={{ border:`1px solid ${done?'#bbf7d0':overdue?'#fecaca':'#e5e7eb'}`, borderRadius:8, background:done?'#f0fdf4':overdue?'#fff7f7':'white', overflow:'hidden' }}>
                          {/* Main row */}
                          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px' }}>
                            {/* Status selector — always visible */}
                            <select
                              value={ms.status}
                              disabled={!canEdit}
                              onChange={e=>setMilestoneStatus(ms, e.target.value as 'pending'|'in_progress'|'completed')}
                              style={{
                                border:'none', borderRadius:20, padding:'4px 10px', fontSize:11, fontWeight:700,
                                cursor: canEdit ? 'pointer' : 'default',
                                background: done ? '#15803d' : ms.status==='in_progress' ? '#b45309' : overdue ? '#ef4444' : '#e5e7eb',
                                color: done || ms.status==='in_progress' || overdue ? 'white' : '#374151',
                                appearance:'none', WebkitAppearance:'none',
                                outline:'none', minWidth:90, textAlign:'center',
                              }}
                            >
                              <option value="pending">⏳ Pending</option>
                              <option value="in_progress">🔄 Active</option>
                              <option value="completed">✅ Done</option>
                            </select>

                            {/* Title / edit input */}
                            {isEditing ? (
                              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:5 }}>
                                <div style={{ display:'flex', gap:5 }}>
                                  <input value={editingMsTitle} onChange={e=>setEditingMsTitle(e.target.value)}
                                    onKeyDown={e=>{ if(e.key==='Enter') saveMilestoneEdit(ms); if(e.key==='Escape') setEditingMsId(null) }}
                                    autoFocus
                                    style={{ flex:2, border:'1px solid #1a3a2a', borderRadius:5, padding:'4px 8px', fontSize:12, outline:'none' }} />
                                  <input type="date" title="Start date" value={editingMsStartDate} onChange={e=>setEditingMsStartDate(e.target.value)}
                                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 7px', fontSize:12 }} />
                                  <input type="date" title="End date" value={editingMsDate} onChange={e=>setEditingMsDate(e.target.value)}
                                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 7px', fontSize:12 }} />
                                </div>
                                <div style={{ display:'flex', gap:5, alignItems:'center' }}>
                                  <input type="number" value={editingMsAmount} onChange={e=>setEditingMsAmount(e.target.value)} placeholder="Amount KES (optional)"
                                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'4px 8px', fontSize:12, outline:'none' }} />
                                  <div style={{ display:'flex', gap:3 }}>
                                    {MS_COLORS.map(c => (
                                      <div key={c} onClick={()=>setEditingMsColor(c)} style={{ width:16, height:16, borderRadius:'50%', background:c, cursor:'pointer', border: editingMsColor===c ? '2px solid #111827' : '2px solid transparent', boxSizing:'border-box' }} />
                                    ))}
                                  </div>
                                  <button onClick={()=>saveMilestoneEdit(ms)} disabled={msSaving}
                                    style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:5, padding:'4px 12px', fontSize:12, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>
                                    {msSaving?'…':'Save'}
                                  </button>
                                  <button onClick={()=>setEditingMsId(null)}
                                    style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, padding:'4px 10px', fontSize:12, cursor:'pointer', color:'#6b7280', whiteSpace:'nowrap' }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {ms.color && <div style={{ width:4, height:'100%', minHeight:28, borderRadius:2, background:done?'#9ca3af':ms.color, flexShrink:0, alignSelf:'stretch' }} />}
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:13, color:done?'#6b7280':'#111827', textDecoration:done?'line-through':'none', fontWeight:500 }}>{ms.title}</div>
                                  <div style={{ fontSize:11, marginTop:1, display:'flex', gap:8, flexWrap:'wrap' }}>
                                    {ms.start_date && <span style={{ color:'#9ca3af' }}>{fmtDate(ms.start_date)}</span>}
                                    {ms.due_date && (
                                      <span style={{ color:done?'#9ca3af':overdue?'#dc2626':dl<=3?'#d97706':'#9ca3af', fontWeight:overdue?700:400 }}>
                                        {ms.start_date ? '→ ' : 'Due '}{fmtDate(ms.due_date)}{overdue?` · ${Math.abs(dl)}d overdue`:dl===0&&!done?' · today':''}
                                      </span>
                                    )}
                                    {ms.amount > 0 && <span style={{ color:'#6b7280', fontWeight:600 }}>KES {ms.amount.toLocaleString()}</span>}
                                  </div>
                                </div>
                                {canEdit && (
                                  <button onClick={()=>{ setEditingMsId(ms.id); setEditingMsTitle(ms.title); setEditingMsDate(ms.due_date||''); setEditingMsStartDate(ms.start_date||''); setEditingMsColor(ms.color||'#2563eb'); setEditingMsAmount(ms.amount ? String(ms.amount) : '') }}
                                    title="Edit title / date"
                                    style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, color:'#6b7280', cursor:'pointer', fontSize:11, padding:'3px 8px' }}>
                                    Edit
                                  </button>
                                )}
                                {canDelete && (
                                  <button onClick={()=>deleteMilestone(ms.id)}
                                    style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:14, padding:'0 2px', lineHeight:1 }}>✕</button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  {canEdit && (
                    <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:6 }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <input value={msTitle} onChange={e=>setMsTitle(e.target.value)} placeholder="Phase / milestone name…"
                          onKeyDown={e=>{ if(e.key==='Enter') addMilestone() }}
                          style={{ flex:2, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 9px', fontSize:12, outline:'none' }}/>
                        <input type="date" title="Start date" value={msStartDate} onChange={e=>setMsStartDate(e.target.value)}
                          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 7px', fontSize:12, outline:'none' }}/>
                        <input type="date" title="End date" value={msDate} onChange={e=>setMsDate(e.target.value)}
                          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 7px', fontSize:12, outline:'none' }}/>
                      </div>
                      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                        <input type="number" value={msAmount} onChange={e=>setMsAmount(e.target.value)} placeholder="Amount KES (optional)"
                          style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'6px 9px', fontSize:12, outline:'none' }}/>
                        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                          {MS_COLORS.map(c => (
                            <div key={c} onClick={()=>setMsColor(c)} style={{ width:18, height:18, borderRadius:'50%', background:c, cursor:'pointer', border: msColor===c ? '2px solid #111827' : '2px solid transparent', boxSizing:'border-box' }} />
                          ))}
                        </div>
                        <button onClick={addMilestone} disabled={!msTitle.trim()||msAdding}
                          style={{ background:msTitle.trim()?'#1a3a2a':'#e5e7eb', color:msTitle.trim()?'white':'#9ca3af', border:'none', borderRadius:5, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:msTitle.trim()?'pointer':'default', whiteSpace:'nowrap' }}>
                          {msAdding?'…':'Add'}
                        </button>
                      </div>
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
                    <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:showLinkTask?10:0 }}>
                      {filteredTasks.map((t:any)=>{
                        const dot = t.status==='resolved'?'#15803d':t.status==='action-required'?'#dc2626':'#d97706'
                        const isExpanded = expandedTaskId === String(t.id)
                        const priBg  = t.priority==='high'?'#fef2f2':t.priority==='low'?'#f0fdf4':'#fffbeb'
                        const priCol = t.priority==='high'?'#dc2626':t.priority==='low'?'#15803d':'#d97706'
                        const statusLabel: Record<string,string> = {
                          'pending-discussion':'Pending','action-required':'Action Required',
                          'in-review':'In Review','awaiting-hod-approval':'Awaiting HOD',
                          'awaiting-hk-approval':'Awaiting HK','resolved':'Resolved',
                          'expired':'Expired','archived':'Archived',
                        }
                        const remarks: any[] = Array.isArray(t.task_updates) ? t.task_updates : []
                        return (
                          <div key={t.id} style={{ border:'1px solid #e5e7eb', borderRadius:6, overflow:'hidden', background:'white' }}>
                            {/* Summary row */}
                            <div
                              onClick={()=>{ setExpandedTaskId(isExpanded ? null : String(t.id)); setRemarkText('') }}
                              style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 9px', background:'#f9fafb', cursor:'pointer', userSelect:'none' }}
                            >
                              <div style={{ width:7, height:7, borderRadius:'50%', background:dot, flexShrink:0 }}/>
                              <span style={{ flex:1, fontSize:12, color:'#111827', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.particulars}</span>
                              {t.priority && (
                                <span style={{ fontSize:9, fontWeight:700, background:priBg, color:priCol, borderRadius:3, padding:'1px 5px', whiteSpace:'nowrap', textTransform:'uppercase' }}>{t.priority}</span>
                              )}
                              <span style={{ fontSize:10, color:'#9ca3af', whiteSpace:'nowrap' }}>{t.responsible}</span>
                              {t.due_date && <span style={{ fontSize:10, color: daysLeft(t.due_date)<0?'#dc2626':'#9ca3af', whiteSpace:'nowrap' }}>{fmtDateShort(t.due_date)}</span>}
                              <span style={{ fontSize:10, color:'#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                              {canEdit && (
                                <button onClick={e=>{ e.stopPropagation(); unlinkTask(t.id) }} title="Unlink"
                                  style={{ background:'none', border:'1px solid #e5e7eb', color:'#9ca3af', borderRadius:3, padding:'1px 5px', fontSize:10, cursor:'pointer', flexShrink:0 }}>✕</button>
                              )}
                            </div>

                            {/* Expanded detail */}
                            {isExpanded && (
                              <div style={{ padding:'10px 12px', borderTop:'1px solid #e5e7eb' }}>
                                {/* Fields row */}
                                <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:10, fontSize:11 }}>
                                  <div><span style={{ color:'#9ca3af' }}>Status: </span><span style={{ fontWeight:600, color:'#374151' }}>{statusLabel[t.status] || t.status}</span></div>
                                  <div><span style={{ color:'#9ca3af' }}>Responsible: </span><span style={{ fontWeight:600, color:'#374151' }}>{t.responsible || '—'}</span></div>
                                  <div><span style={{ color:'#9ca3af' }}>Due: </span><span style={{ fontWeight:600, color: t.due_date && daysLeft(t.due_date)<0?'#dc2626':'#374151' }}>{t.due_date ? fmtDateShort(t.due_date) : '—'}</span></div>
                                  <div><span style={{ color:'#9ca3af' }}>Priority: </span><span style={{ fontWeight:700, color:priCol }}>{t.priority || '—'}</span></div>
                                </div>

                                {/* Remarks */}
                                <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.04em' }}>
                                  Remarks {remarks.length > 0 && `(${remarks.length})`}
                                </div>
                                {remarks.length > 0 ? (
                                  <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:8 }}>
                                    {remarks.map((r:any) => (
                                      <div key={r.id} style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:5, padding:'6px 9px' }}>
                                        <div style={{ fontSize:12, color:'#111827', whiteSpace:'pre-wrap' }}>{r.text}</div>
                                        <div style={{ fontSize:10, color:'#9ca3af', marginTop:3 }}>{r.added_by || 'System'} · {r.date || ''}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ fontSize:11, color:'#9ca3af', marginBottom:8 }}>No remarks yet.</div>
                                )}

                                {/* Add remark */}
                                <div style={{ display:'flex', gap:5 }}>
                                  <textarea
                                    value={remarkText}
                                    onChange={e=>setRemarkText(e.target.value)}
                                    placeholder="Add a remark…"
                                    rows={2}
                                    style={{ flex:1, border:'1px solid #d1d5db', borderRadius:5, padding:'5px 8px', fontSize:12, resize:'vertical', outline:'none', fontFamily:'inherit' }}
                                  />
                                  <button
                                    onClick={()=>addRemark(String(t.id))}
                                    disabled={!remarkText.trim() || remarkSaving}
                                    style={{ alignSelf:'flex-end', background: remarkText.trim() ? '#1a3a2a' : '#e5e7eb', color: remarkText.trim() ? 'white' : '#9ca3af', border:'none', borderRadius:5, padding:'6px 12px', fontSize:11, fontWeight:600, cursor: remarkText.trim() ? 'pointer' : 'default' }}
                                  >
                                    {remarkSaving ? '…' : 'Add'}
                                  </button>
                                </div>
                              </div>
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

                {/* Governance Indicators */}
                {(() => {
                  const openRisks     = risks.filter(r => r.type === 'risk' && (r.status === 'open' || r.status === 'in_progress')).length
                  const critHighRisks = risks.filter(r => r.type === 'risk' && (r.severity === 'critical' || r.severity === 'high') && (r.status === 'open' || r.status === 'in_progress')).length
                  const openIssues    = risks.filter(r => r.type === 'issue' && (r.status === 'open' || r.status === 'in_progress')).length
                  const pendingDecs   = decisions.filter(d => d.status === 'pending').length
                  if (!risksLoaded && !decisionsLoaded) return null
                  return (
                    <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'14px 18px' }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.5px' }}>Governance</div>
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                        {[
                          { label:'Open Risks',       val:openRisks,     color: openRisks>0 ? '#c2410c' : '#15803d',     tab:'risks' as const },
                          { label:'Critical/High',    val:critHighRisks, color: critHighRisks>0 ? '#dc2626' : '#15803d', tab:'risks' as const },
                          { label:'Open Issues',      val:openIssues,    color: openIssues>0 ? '#d97706' : '#15803d',    tab:'risks' as const },
                          { label:'Pending Decisions',val:pendingDecs,   color: pendingDecs>0 ? '#7c3aed' : '#15803d',   tab:'decisions' as const },
                        ].map(s => (
                          <button key={s.label} onClick={()=>setDetailTab(s.tab)}
                            style={{ textAlign:'center', padding:'10px', background:'white', borderRadius:6, border:'1px solid #e5e7eb', cursor:'pointer' }}>
                            <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:3 }}>{s.label}</div>
                            <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.val}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                {/* Recent Activity */}
                {activityLoaded && activityFeed.length > 0 && (
                  <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'14px 18px' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'0.5px' }}>Recent Activity</div>
                      <button onClick={()=>setDetailTab('activity')}
                        style={{ background:'none', border:'none', color:'#1a3a2a', fontSize:11, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>
                        View all →
                      </button>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                      {activityFeed.slice(0, 5).map(ev => (
                        <div key={ev.id} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
                          <div style={{ width:6, height:6, borderRadius:'50%', background:'#9ca3af', marginTop:5, flexShrink:0 }} />
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:12, color:'#374151', lineHeight:'1.4' }}>{ev.description}</div>
                            <div style={{ fontSize:11, color:'#9ca3af', marginTop:1 }}>
                              {new Date(ev.created_at).toLocaleString('en-GB', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    const pcrTotal     = (pcrs as any[]).filter(r=>r.status==='approved').reduce((s:number,r:any)=>s+Number(r.total_amount),0)
                    const manualTotal  = expenses.reduce((s,e)=>s+e.amount, 0)
                    const lpoAccepted  = (lpos as any[]).filter(r=>r.status==='accepted').reduce((s:number,r:any)=>s+Number(r.total),0)
                    const lpoPaid      = (lpos as any[]).filter(r=>r.status==='paid').reduce((s:number,r:any)=>s+Number(r.total),0)
                    const lpoTotal     = lpoAccepted + lpoPaid
                    const totalSpent   = pcrTotal + manualTotal + lpoTotal
                    const pct          = Math.min(100, Math.round((totalSpent / active.budget) * 100))
                    const over         = totalSpent > active.budget
                    const warn         = !over && pct >= 80
                    return (
                      <div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:14 }}>
                          {[
                            { label:'Budget',    val:`KES ${active.budget.toLocaleString()}`,            color:'#374151' },
                            { label:'PCRs',      val:`KES ${pcrTotal.toLocaleString()}`,                 color:'#1d4ed8' },
                            { label:'LPOs',      val:`KES ${lpoTotal.toLocaleString()}`,                 color:'#6d28d9' },
                            { label:'Other',     val:`KES ${manualTotal.toLocaleString()}`,              color:'#374151' },
                          ].map(s=>(
                            <div key={s.label} style={{ textAlign:'center', padding:'10px', background:'white', borderRadius:6, border:'1px solid #e5e7eb' }}>
                              <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:3 }}>{s.label}</div>
                              <div style={{ fontSize:13, fontWeight:800, color:s.color }}>{s.val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#374151', marginBottom:6 }}>
                          <span style={{ fontWeight:700 }}>Total spent: <span style={{ color: over?'#dc2626':warn?'#d97706':'#1a3a2a' }}>KES {totalSpent.toLocaleString()}</span></span>
                          <span style={{ color: over?'#dc2626':warn?'#d97706':'#15803d', fontWeight:700 }}>
                            {over ? `🚨 Over by KES ${(totalSpent-active.budget).toLocaleString()}` : `KES ${(active.budget-totalSpent).toLocaleString()} remaining`}
                          </span>
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

                {/* LPOs linked to project */}
                <div style={{ marginBottom:22 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827' }}>
                      Local Purchase Orders {lpos.length > 0 && `(${lpos.length})`}
                    </div>
                    <a href="/finance" style={{ fontSize:12, color:'#6d28d9', fontWeight:600, textDecoration:'none' }}>
                      + Raise LPO in Finance →
                    </a>
                  </div>
                  <div style={{ fontSize:12, color:'#9ca3af', marginBottom:8 }}>
                    LPOs with status <strong>Accepted</strong> or <strong>Paid</strong> count towards spend. Draft/Sent LPOs are shown for reference only.
                  </div>
                  {budgetLoaded && lpos.length === 0 && (
                    <div style={{ fontSize:12, color:'#9ca3af', padding:'8px 0' }}>
                      No LPOs linked to this project yet. When creating an LPO in Finance, select this project to track it here.
                    </div>
                  )}
                  {lpos.length > 0 && (
                    <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                        <thead>
                          <tr style={{ background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                            {['LPO No','Supplier','Date','Amount','Status',''].map(h=>(
                              <th key={h} style={{ padding:'8px 10px', textAlign:'left', fontSize:10, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'0.4px', whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(lpos as any[]).map((r,i)=>{
                            const countsAsSpend = r.status === 'accepted' || r.status === 'paid'
                            const statusStyle   = INVOICE_STATUS_STYLE[r.status as InvoiceStatus] || { bg:'#f3f4f6', color:'#6b7280' }
                            return (
                              <tr key={r.id} style={{ borderBottom: i<lpos.length-1?'1px solid #f3f4f6':'none', background: countsAsSpend?'#faf5ff':'white' }}>
                                <td style={{ padding:'8px 10px', fontWeight:600, color:'#6d28d9', whiteSpace:'nowrap' }}>{r.doc_no || `#${r.id}`}</td>
                                <td style={{ padding:'8px 10px', color:'#374151' }}>{r.supplier || '—'}</td>
                                <td style={{ padding:'8px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>{r.issue_date ? fmtDateShort(String(r.issue_date).slice(0,10)) : '—'}</td>
                                <td style={{ padding:'8px 10px', fontWeight:600, color: countsAsSpend?'#1a3a2a':'#9ca3af', whiteSpace:'nowrap' }}>
                                  KES {Number(r.total).toLocaleString()}
                                  {!countsAsSpend && <span style={{ fontSize:10, color:'#d1d5db', marginLeft:4 }}>(not counted)</span>}
                                </td>
                                <td style={{ padding:'8px 10px', whiteSpace:'nowrap' }}>
                                  <span style={{ background:statusStyle.bg, color:statusStyle.color, borderRadius:10, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                                    {INVOICE_STATUS_LABELS[r.status as InvoiceStatus] || r.status}
                                  </span>
                                </td>
                                <td style={{ padding:'8px 10px' }}>
                                  <a href="/finance" style={{ fontSize:11, color:'#6d28d9', textDecoration:'none', fontWeight:600 }}>View</a>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background:'#f9fafb', borderTop:'2px solid #e5e7eb' }}>
                            <td colSpan={3} style={{ padding:'8px 10px', fontSize:12, fontWeight:700, color:'#374151', textAlign:'right' }}>LPO Total (accepted + paid)</td>
                            <td style={{ padding:'8px 10px', fontWeight:800, color:'#6d28d9', fontSize:13 }}>
                              KES {(lpos as any[]).filter(r=>r.status==='accepted'||r.status==='paid').reduce((s:number,r:any)=>s+Number(r.total),0).toLocaleString()}
                            </td>
                            <td colSpan={2}/>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
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
                  {(pcrs.length > 0 || expenses.length > 0 || lpos.length > 0) && (
                    <div style={{ marginTop:14, padding:'14px 18px', background:'#1a3a2a', borderRadius:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                        <span style={{ fontSize:13, fontWeight:700, color:'white' }}>Total Project Spend</span>
                        <span style={{ fontSize:16, fontWeight:800, color:'white' }}>KES {active.spent.toLocaleString()}</span>
                      </div>
                      <div style={{ display:'flex', gap:16, fontSize:11, color:'rgba(255,255,255,0.65)' }}>
                        <span>PCRs: KES {(pcrs as any[]).filter(r=>r.status==='approved').reduce((s:number,r:any)=>s+Number(r.total_amount),0).toLocaleString()}</span>
                        <span>LPOs: KES {(lpos as any[]).filter(r=>r.status==='accepted'||r.status==='paid').reduce((s:number,r:any)=>s+Number(r.total),0).toLocaleString()}</span>
                        <span>Other: KES {expenses.reduce((s,e)=>s+e.amount,0).toLocaleString()}</span>
                      </div>
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

            {/* ── UPDATES TAB ── */}
            {detailTab === 'updates' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:16 }}>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>
                    Updates <span style={{ fontWeight:400, color:'#94a3b8', fontSize:12 }}>({updates.length})</span>
                  </div>
                  {canEdit && (
                    <button onClick={()=>setShowNewUpdate(v=>!v)}
                      style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      + New Update
                    </button>
                  )}
                </div>

                {/* New update form */}
                {showNewUpdate && (
                  <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'16px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Type</label>
                        <select value={updateForm.type} onChange={e=>setUpdateForm(f=>({...f,type:e.target.value as UpdateType}))}
                          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'6px 8px', fontSize:12 }}>
                          {(Object.keys(UPDATE_TYPE_CONFIG) as UpdateType[]).map(t=><option key={t} value={t}>{UPDATE_TYPE_CONFIG[t].label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Owner</label>
                        <select value={updateForm.owner} onChange={e=>setUpdateForm(f=>({...f,owner:e.target.value}))}
                          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'6px 8px', fontSize:12 }}>
                          <option value="">— none —</option>
                          {[...PEOPLE].map(p=><option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Title *</label>
                      <input value={updateForm.title} onChange={e=>setUpdateForm(f=>({...f,title:e.target.value}))}
                        placeholder="Brief headline…"
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Details</label>
                      <textarea value={updateForm.body} onChange={e=>setUpdateForm(f=>({...f,body:e.target.value}))}
                        rows={3} placeholder="Describe the update…"
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, resize:'vertical', boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Next Steps</label>
                      <input value={updateForm.next_steps} onChange={e=>setUpdateForm(f=>({...f,next_steps:e.target.value}))}
                        placeholder="What happens next…"
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button onClick={()=>{setShowNewUpdate(false);setUpdateForm({...BLANK_UPDATE})}}
                        style={{ background:'#f3f4f6', color:'#374151', border:'none', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer' }}>Cancel</button>
                      <button onClick={postUpdate} disabled={!updateForm.title.trim()||updateSaving}
                        style={{ background:updateForm.title.trim()?'#1a3a2a':'#9ca3af', color:'white', border:'none', borderRadius:6, padding:'7px 16px', fontSize:12, fontWeight:600, cursor:updateForm.title.trim()?'pointer':'not-allowed' }}>
                        {updateSaving?'Posting…':'Post Update'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Updates list */}
                {!updatesLoaded && <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', paddingTop:20 }}>Loading…</div>}
                {updatesLoaded && updates.length === 0 && (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af', fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>📝</div>
                    No updates yet. Post the first one.
                  </div>
                )}
                {updates.map(u => {
                  const tc = UPDATE_TYPE_CONFIG[u.type]
                  const sc = UPDATE_STATUS_CONFIG[u.status]
                  const expanded = expandedUpdate === u.id
                  return (
                    <div key={u.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, background:'white', overflow:'hidden' }}>
                      <div style={{ padding:'14px 16px' }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:8 }}>
                          <span style={{ background:tc.bg, color:tc.color, fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, flexShrink:0, marginTop:2 }}>{tc.label}</span>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:'#0f172a', lineHeight:1.3 }}>{u.title}</div>
                            {u.owner && <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>Owner: {u.owner}</div>}
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                            {canEdit && (
                              <select value={u.status} onChange={e=>patchUpdateStatus(u,e.target.value as UpdateStatus)}
                                style={{ border:`1px solid ${sc.color}40`, background:sc.bg, color:sc.color, borderRadius:6, padding:'2px 6px', fontSize:11, fontWeight:600, cursor:'pointer' }}>
                                {(Object.keys(UPDATE_STATUS_CONFIG) as UpdateStatus[]).map(s=><option key={s} value={s}>{UPDATE_STATUS_CONFIG[s].label}</option>)}
                              </select>
                            )}
                            {!canEdit && <span style={{ background:sc.bg, color:sc.color, fontSize:11, fontWeight:600, padding:'2px 7px', borderRadius:6 }}>{sc.label}</span>}
                            {canEdit && (
                              <button onClick={()=>deleteUpdate(u.id)}
                                style={{ background:'none', border:'none', color:'#ef4444', fontSize:13, cursor:'pointer', padding:'2px 4px' }}>✕</button>
                            )}
                          </div>
                        </div>
                        {u.body && <div style={{ fontSize:12, color:'#374151', lineHeight:1.6, marginBottom:6 }}>{u.body}</div>}
                        {u.next_steps && (
                          <div style={{ fontSize:11, color:'#64748b', background:'#f8fafc', borderRadius:6, padding:'6px 10px', marginBottom:6 }}>
                            <strong>Next:</strong> {u.next_steps}
                          </div>
                        )}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:6 }}>
                          <span style={{ fontSize:11, color:'#94a3b8' }}>
                            {u.posted_by} · {fmtTs(u.created_at)}
                            {u.comments.length > 0 && <span style={{ marginLeft:8, color:'#6b7280' }}>{u.comments.length} comment{u.comments.length>1?'s':''}</span>}
                          </span>
                          <button onClick={()=>setExpandedUpdate(expanded?null:u.id)}
                            style={{ background:'none', border:'none', fontSize:11, color:'#6b7280', cursor:'pointer', fontWeight:600 }}>
                            {expanded ? 'Hide' : `Reply${u.comments.length>0?' ('+u.comments.length+')':''}`}
                          </button>
                        </div>
                      </div>

                      {/* Comments */}
                      {expanded && (
                        <div style={{ borderTop:'1px solid #f3f4f6', padding:'10px 16px', background:'#fafafa' }}>
                          {u.comments.map(c => (
                            <div key={c.id} style={{ display:'flex', gap:8, marginBottom:8 }}>
                              <div style={{ width:26, height:26, borderRadius:'50%', background:avatarColor(c.user_name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'white', flexShrink:0 }}>
                                {avatarInitials(c.user_name)}
                              </div>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:11, fontWeight:600, color:'#374151' }}>{c.user_name} <span style={{ fontWeight:400, color:'#94a3b8' }}>{fmtTs(c.created_at)}</span></div>
                                <div style={{ fontSize:12, color:'#374151', lineHeight:1.5 }}>{c.message}</div>
                              </div>
                            </div>
                          ))}
                          <div style={{ display:'flex', gap:8, marginTop:8 }}>
                            <input value={commentDraft[u.id]||''} onChange={e=>setCommentDraft(p=>({...p,[u.id]:e.target.value}))}
                              onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();postUpdateComment(u.id)} }}
                              placeholder="Add a comment…"
                              style={{ flex:1, border:'1px solid #d1d5db', borderRadius:6, padding:'6px 10px', fontSize:12, outline:'none' }}/>
                            <button onClick={()=>postUpdateComment(u.id)} disabled={!commentDraft[u.id]?.trim()||commentSaving[u.id]}
                              style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer' }}>
                              {commentSaving[u.id]?'…':'Send'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── MEETINGS TAB ── */}
            {detailTab === 'meetings' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:16 }}>

                {/* Header */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ fontSize:13, fontWeight:700, color:'#0f172a' }}>
                    Meetings <span style={{ fontWeight:400, color:'#94a3b8', fontSize:12 }}>({meetings.length})</span>
                  </div>
                  {canEdit && (
                    <button onClick={()=>setShowNewMeeting(v=>!v)}
                      style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      + Log Meeting
                    </button>
                  )}
                </div>

                {/* New meeting form */}
                {showNewMeeting && (
                  <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:10, padding:'16px' }}>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Title *</label>
                        <input value={meetingForm.title} onChange={e=>setMeetingForm(f=>({...f,title:e.target.value}))}
                          placeholder="Meeting title…"
                          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, boxSizing:'border-box' }}/>
                      </div>
                      <div>
                        <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Date</label>
                        <input type="date" value={meetingForm.meeting_date} onChange={e=>setMeetingForm(f=>({...f,meeting_date:e.target.value}))}
                          style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, boxSizing:'border-box' }}/>
                      </div>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Attendees</label>
                      <input value={meetingForm.attendees} onChange={e=>setMeetingForm(f=>({...f,attendees:e.target.value}))}
                        placeholder="Names or roles present…"
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Agenda</label>
                      <textarea value={meetingForm.agenda} onChange={e=>setMeetingForm(f=>({...f,agenda:e.target.value}))}
                        rows={2} placeholder="What was on the agenda…"
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, resize:'vertical', boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ marginBottom:10 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Notes / Minutes</label>
                      <textarea value={meetingForm.notes} onChange={e=>setMeetingForm(f=>({...f,notes:e.target.value}))}
                        rows={3} placeholder="Meeting notes…"
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, resize:'vertical', boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ marginBottom:14 }}>
                      <label style={{ fontSize:11, fontWeight:600, color:'#64748b', display:'block', marginBottom:3 }}>Action Points</label>
                      <textarea value={meetingForm.action_points} onChange={e=>setMeetingForm(f=>({...f,action_points:e.target.value}))}
                        rows={2} placeholder="Agreed actions and owners…"
                        style={{ width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px', fontSize:12, resize:'vertical', boxSizing:'border-box' }}/>
                    </div>
                    <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                      <button onClick={()=>{setShowNewMeeting(false);setMeetingForm({...BLANK_MEETING})}}
                        style={{ background:'#f3f4f6', color:'#374151', border:'none', borderRadius:6, padding:'7px 14px', fontSize:12, cursor:'pointer' }}>Cancel</button>
                      <button onClick={postMeeting} disabled={!meetingForm.title.trim()||meetingSaving}
                        style={{ background:meetingForm.title.trim()?'#1a3a2a':'#9ca3af', color:'white', border:'none', borderRadius:6, padding:'7px 16px', fontSize:12, fontWeight:600, cursor:meetingForm.title.trim()?'pointer':'not-allowed' }}>
                        {meetingSaving?'Saving…':'Log Meeting'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Meetings list */}
                {!meetingsLoaded && <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', paddingTop:20 }}>Loading…</div>}
                {meetingsLoaded && meetings.length === 0 && (
                  <div style={{ textAlign:'center', padding:'40px 20px', color:'#9ca3af', fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>🗓</div>
                    No meetings logged yet.
                  </div>
                )}
                {meetings.map(m => {
                  const expanded = expandedMeeting === m.id
                  return (
                    <div key={m.id} style={{ border:'1px solid #e5e7eb', borderRadius:10, background:'white', overflow:'hidden' }}>
                      <div style={{ padding:'14px 16px', cursor:'pointer' }} onClick={()=>setExpandedMeeting(expanded?null:m.id)}>
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:10 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:14, fontWeight:700, color:'#0f172a' }}>{m.title}</div>
                            <div style={{ fontSize:11, color:'#64748b', marginTop:2 }}>
                              {m.meeting_date ? fmtDate(m.meeting_date) : '—'}
                              {m.attendees && <span style={{ marginLeft:8 }}>· {m.attendees}</span>}
                            </div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                            <span style={{ fontSize:11, color:'#94a3b8' }}>Logged by {m.logged_by}</span>
                            {canEdit && (
                              <button onClick={e=>{e.stopPropagation();deleteMeeting(m.id)}}
                                style={{ background:'none', border:'none', color:'#ef4444', fontSize:13, cursor:'pointer', padding:'2px 4px' }}>✕</button>
                            )}
                            <span style={{ fontSize:14, color:'#94a3b8' }}>{expanded?'▲':'▼'}</span>
                          </div>
                        </div>
                      </div>
                      {expanded && (
                        <div style={{ borderTop:'1px solid #f3f4f6', padding:'14px 16px', background:'#fafafa', display:'flex', flexDirection:'column', gap:12 }}>
                          {m.agenda && (
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Agenda</div>
                              <div style={{ fontSize:12, color:'#374151', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{m.agenda}</div>
                            </div>
                          )}
                          {m.notes && (
                            <div>
                              <div style={{ fontSize:11, fontWeight:700, color:'#64748b', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Notes / Minutes</div>
                              <div style={{ fontSize:12, color:'#374151', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{m.notes}</div>
                            </div>
                          )}
                          {m.action_points && (() => {
                            const lines = m.action_points.split('\n').map(l => l.trim()).filter(Boolean)
                            const taskMap: Record<string, MeetingActionTask> = {}
                            ;(m.action_tasks || []).forEach(at => { taskMap[at.action_text.slice(0,500)] = at })
                            return (
                              <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'10px 12px' }}>
                                <div style={{ fontSize:11, fontWeight:700, color:'#15803d', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Action Points</div>
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  {lines.map((line, i) => {
                                    const key = line.slice(0, 500)
                                    const linked = taskMap[key]
                                    return (
                                      <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                                        <span style={{ color:'#15803d', fontWeight:700, fontSize:12, flexShrink:0, marginTop:1 }}>·</span>
                                        <span style={{ fontSize:12, color:'#166534', flex:1, lineHeight:1.5 }}>{line}</span>
                                        {linked ? (
                                          <a href={`/tasks?id=${linked.task_id}`} target="_blank" rel="noreferrer"
                                            style={{ flexShrink:0, fontSize:10, fontWeight:700, background:'#dcfce7', color:'#15803d', border:'1px solid #bbf7d0', borderRadius:4, padding:'2px 7px', textDecoration:'none', whiteSpace:'nowrap' }}>
                                            ✓ Task #{linked.task_id}
                                          </a>
                                        ) : canEdit ? (
                                          <button onClick={()=>{
                                            setConvertModal({ meetingId:m.id, actionText:line, company:active!.company })
                                            setConvertForm({ particulars:line, responsible:'', due_date:'', priority:'medium' as const })
                                            setConvertError('')
                                          }}
                                            style={{ flexShrink:0, fontSize:10, fontWeight:700, background:'white', color:'#1a3a2a', border:'1px solid #15803d', borderRadius:4, padding:'2px 7px', cursor:'pointer', whiteSpace:'nowrap' }}>
                                            → Task
                                          </button>
                                        ) : null}
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── DECISIONS TAB ── */}
            {detailTab === 'decisions' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>
                    Decisions <span style={{ fontWeight:400, color:'#94a3b8', fontSize:12 }}>({decisions.length})</span>
                  </div>
                  {canEdit && !showNewDecision && !editingDecision && (
                    <button onClick={()=>setShowNewDecision(true)}
                      style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 13px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      + Log Decision
                    </button>
                  )}
                </div>

                {/* New decision form */}
                {showNewDecision && (
                  <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'16px', marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:12 }}>New Decision</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <input value={decisionForm.title} onChange={e=>setDecisionForm(p=>({...p,title:e.target.value}))}
                        placeholder="Title *" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                      <textarea value={decisionForm.description} onChange={e=>setDecisionForm(p=>({...p,description:e.target.value}))}
                        placeholder="Description / context" rows={3}
                        style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none', resize:'vertical' }}/>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
                        <select value={decisionForm.status} onChange={e=>setDecisionForm(p=>({...p,status:e.target.value as DecisionStatus}))}
                          style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}>
                          {(['pending','decided','deferred','rejected'] as DecisionStatus[]).map(s=>(
                            <option key={s} value={s}>{DECISION_STATUS_CONFIG[s].label}</option>
                          ))}
                        </select>
                        <input value={decisionForm.owner} onChange={e=>setDecisionForm(p=>({...p,owner:e.target.value}))}
                          placeholder="Owner" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                        <input type="date" value={decisionForm.decision_date} onChange={e=>setDecisionForm(p=>({...p,decision_date:e.target.value}))}
                          style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}/>
                        <input value={decisionForm.source} onChange={e=>setDecisionForm(p=>({...p,source:e.target.value}))}
                          placeholder="Source (meeting, email…)" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <button onClick={postDecision} disabled={decisionSaving || !decisionForm.title.trim()}
                        style={{ background: decisionForm.title.trim() ? '#1a3a2a' : '#e5e7eb', color: decisionForm.title.trim() ? 'white' : '#9ca3af', border:'none', borderRadius:5, padding:'7px 14px', fontSize:12, fontWeight:600, cursor: decisionForm.title.trim() ? 'pointer' : 'default' }}>
                        {decisionSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={()=>{ setShowNewDecision(false); setDecisionForm({...BLANK_DECISION}) }}
                        style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, padding:'7px 14px', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!decisionsLoaded && <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', paddingTop:20 }}>Loading…</div>}
                {decisionsLoaded && decisions.length === 0 && !showNewDecision && (
                  <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', paddingTop:30 }}>No decisions logged yet.</div>
                )}
                {decisions.map(d => {
                  const sc = DECISION_STATUS_CONFIG[d.status]
                  const editing = editingDecision?.id === d.id
                  return (
                    <div key={d.id} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
                      {editing ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          <input value={editDecisionForm.title} onChange={e=>setEditDecisionForm(p=>({...p,title:e.target.value}))}
                            placeholder="Title *" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                          <textarea value={editDecisionForm.description} onChange={e=>setEditDecisionForm(p=>({...p,description:e.target.value}))}
                            placeholder="Description" rows={3}
                            style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none', resize:'vertical' }}/>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
                            <select value={editDecisionForm.status} onChange={e=>setEditDecisionForm(p=>({...p,status:e.target.value as DecisionStatus}))}
                              style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}>
                              {(['pending','decided','deferred','rejected'] as DecisionStatus[]).map(s=>(
                                <option key={s} value={s}>{DECISION_STATUS_CONFIG[s].label}</option>
                              ))}
                            </select>
                            <input value={editDecisionForm.owner} onChange={e=>setEditDecisionForm(p=>({...p,owner:e.target.value}))}
                              placeholder="Owner" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                            <input type="date" value={editDecisionForm.decision_date} onChange={e=>setEditDecisionForm(p=>({...p,decision_date:e.target.value}))}
                              style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}/>
                            <input value={editDecisionForm.source} onChange={e=>setEditDecisionForm(p=>({...p,source:e.target.value}))}
                              placeholder="Source" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                          </div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={saveDecision} disabled={editDecisionSaving}
                              style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:5, padding:'6px 13px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                              {editDecisionSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={()=>setEditingDecision(null)}
                              style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, padding:'6px 13px', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom: d.description ? 8 : 0 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:3 }}>{d.title}</div>
                              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                                <span style={{ background:sc.bg, color:sc.color, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>{sc.label}</span>
                                {d.owner && <span style={{ fontSize:11, color:'#6b7280' }}>Owner: {d.owner}</span>}
                                {d.decision_date && <span style={{ fontSize:11, color:'#6b7280' }}>Date: {fmtDate(d.decision_date)}</span>}
                                {d.source && <span style={{ fontSize:11, color:'#6b7280' }}>Source: {d.source}</span>}
                                <span style={{ fontSize:10, color:'#d1d5db', marginLeft:'auto' }}>by {d.created_by} · {fmtTs(d.created_at)}</span>
                              </div>
                            </div>
                            {canEdit && (
                              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                                <button onClick={()=>{ setEditingDecision(d); setEditDecisionForm({ title:d.title, description:d.description, status:d.status, owner:d.owner, decision_date:d.decision_date||'', source:d.source }) }}
                                  style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, padding:'4px 9px', fontSize:11, cursor:'pointer', color:'#6b7280' }}>Edit</button>
                                {canDelete && (
                                  <button onClick={()=>deleteDecision(d.id)}
                                    style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:14, padding:'0 3px' }}>✕</button>
                                )}
                              </div>
                            )}
                          </div>
                          {d.description && <div style={{ fontSize:12, color:'#374151', lineHeight:1.5, marginTop:4 }}>{d.description}</div>}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── RISKS & ISSUES TAB ── */}
            {detailTab === 'risks' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#111827' }}>
                    Risks &amp; Issues <span style={{ fontWeight:400, color:'#94a3b8', fontSize:12 }}>({risks.length})</span>
                  </div>
                  {canEdit && !showNewRisk && !editingRisk && (
                    <button onClick={()=>setShowNewRisk(true)}
                      style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 13px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                      + Log Risk / Issue
                    </button>
                  )}
                </div>

                {/* New risk form */}
                {showNewRisk && (
                  <div style={{ background:'#f9fafb', border:'1px solid #e5e7eb', borderRadius:10, padding:'16px', marginBottom:16 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:12 }}>New Risk / Issue</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <select value={riskForm.type} onChange={e=>setRiskForm(p=>({...p,type:e.target.value as RiskType}))}
                          style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}>
                          <option value="risk">Risk</option>
                          <option value="issue">Issue</option>
                        </select>
                        <select value={riskForm.severity} onChange={e=>setRiskForm(p=>({...p,severity:e.target.value as RiskSeverity}))}
                          style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}>
                          {(['low','medium','high','critical'] as RiskSeverity[]).map(s=>(
                            <option key={s} value={s}>{RISK_SEVERITY_CONFIG[s].label}</option>
                          ))}
                        </select>
                      </div>
                      <input value={riskForm.title} onChange={e=>setRiskForm(p=>({...p,title:e.target.value}))}
                        placeholder="Title *" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                      <textarea value={riskForm.description} onChange={e=>setRiskForm(p=>({...p,description:e.target.value}))}
                        placeholder="Description / impact" rows={3}
                        style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none', resize:'vertical' }}/>
                      <textarea value={riskForm.mitigation} onChange={e=>setRiskForm(p=>({...p,mitigation:e.target.value}))}
                        placeholder="Mitigation / response plan" rows={2}
                        style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none', resize:'vertical' }}/>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <input value={riskForm.owner} onChange={e=>setRiskForm(p=>({...p,owner:e.target.value}))}
                          placeholder="Owner" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                        <input type="date" value={riskForm.target_date} onChange={e=>setRiskForm(p=>({...p,target_date:e.target.value}))}
                          placeholder="Target date"
                          style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}/>
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginTop:12 }}>
                      <button onClick={postRisk} disabled={riskSaving || !riskForm.title.trim()}
                        style={{ background: riskForm.title.trim() ? '#1a3a2a' : '#e5e7eb', color: riskForm.title.trim() ? 'white' : '#9ca3af', border:'none', borderRadius:5, padding:'7px 14px', fontSize:12, fontWeight:600, cursor: riskForm.title.trim() ? 'pointer' : 'default' }}>
                        {riskSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button onClick={()=>{ setShowNewRisk(false); setRiskForm({...BLANK_RISK}) }}
                        style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, padding:'7px 14px', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {!risksLoaded && <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', paddingTop:20 }}>Loading…</div>}
                {risksLoaded && risks.length === 0 && !showNewRisk && (
                  <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', paddingTop:30 }}>No risks or issues logged yet.</div>
                )}
                {risks.map(r => {
                  const sevc = RISK_SEVERITY_CONFIG[r.severity]
                  const stac = RISK_STATUS_CONFIG[r.status]
                  const editing = editingRisk?.id === r.id
                  return (
                    <div key={r.id} style={{ background:'white', border:`1px solid ${r.severity==='critical'?'#fecaca':r.severity==='high'?'#fed7aa':'#e5e7eb'}`, borderLeft:`3px solid ${sevc.color}`, borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
                      {editing ? (
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            <select value={editRiskForm.type} onChange={e=>setEditRiskForm(p=>({...p,type:e.target.value as RiskType}))}
                              style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}>
                              <option value="risk">Risk</option>
                              <option value="issue">Issue</option>
                            </select>
                            <select value={editRiskForm.severity} onChange={e=>setEditRiskForm(p=>({...p,severity:e.target.value as RiskSeverity}))}
                              style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}>
                              {(['low','medium','high','critical'] as RiskSeverity[]).map(s=>(
                                <option key={s} value={s}>{RISK_SEVERITY_CONFIG[s].label}</option>
                              ))}
                            </select>
                          </div>
                          <input value={editRiskForm.title} onChange={e=>setEditRiskForm(p=>({...p,title:e.target.value}))}
                            placeholder="Title *" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                          <textarea value={editRiskForm.description} onChange={e=>setEditRiskForm(p=>({...p,description:e.target.value}))}
                            placeholder="Description" rows={3}
                            style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none', resize:'vertical' }}/>
                          <textarea value={editRiskForm.mitigation} onChange={e=>setEditRiskForm(p=>({...p,mitigation:e.target.value}))}
                            placeholder="Mitigation" rows={2}
                            style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none', resize:'vertical' }}/>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                            <input value={editRiskForm.owner} onChange={e=>setEditRiskForm(p=>({...p,owner:e.target.value}))}
                              placeholder="Owner" style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 10px', fontSize:12, outline:'none' }}/>
                            <input type="date" value={editRiskForm.target_date} onChange={e=>setEditRiskForm(p=>({...p,target_date:e.target.value}))}
                              style={{ border:'1px solid #d1d5db', borderRadius:5, padding:'7px 8px', fontSize:12, outline:'none' }}/>
                          </div>
                          <div style={{ display:'flex', gap:8 }}>
                            <button onClick={saveRisk} disabled={editRiskSaving}
                              style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:5, padding:'6px 13px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                              {editRiskSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button onClick={()=>setEditingRisk(null)}
                              style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, padding:'6px 13px', fontSize:12, cursor:'pointer', color:'#6b7280' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom: r.description ? 6 : 0 }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom:4 }}>
                                <span style={{ fontSize:10, fontWeight:700, background: r.type==='issue'?'#dbeafe':'#f3e8ff', color: r.type==='issue'?'#1d4ed8':'#7c3aed', borderRadius:3, padding:'1px 6px', textTransform:'uppercase', letterSpacing:'0.3px' }}>
                                  {r.type}
                                </span>
                                <span style={{ background:sevc.bg, color:sevc.color, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>{sevc.label}</span>
                                <span style={{ background:stac.bg, color:stac.color, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>{stac.label}</span>
                                {canEdit && (
                                  <select value={r.status} onChange={e=>patchRiskStatus(r, e.target.value as RiskStatus)}
                                    style={{ border:'1px solid #e5e7eb', borderRadius:4, padding:'2px 5px', fontSize:10, background:'white', cursor:'pointer', color:'#374151', marginLeft:2 }}>
                                    {(['open','in_progress','resolved','closed'] as RiskStatus[]).map(s=>(
                                      <option key={s} value={s}>{RISK_STATUS_CONFIG[s].label}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                              <div style={{ fontSize:13, fontWeight:700, color:'#111827', marginBottom:2 }}>{r.title}</div>
                              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                                {r.owner && <span style={{ fontSize:11, color:'#6b7280' }}>Owner: {r.owner}</span>}
                                {r.target_date && <span style={{ fontSize:11, color:'#6b7280' }}>Target: {fmtDate(r.target_date)}</span>}
                                <span style={{ fontSize:10, color:'#d1d5db', marginLeft:'auto' }}>by {r.created_by} · {fmtTs(r.created_at)}</span>
                              </div>
                            </div>
                            {canEdit && (
                              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                                <button onClick={()=>{ setEditingRisk(r); setEditRiskForm({ type:r.type, title:r.title, description:r.description, owner:r.owner, severity:r.severity, mitigation:r.mitigation, target_date:r.target_date||'' }) }}
                                  style={{ background:'none', border:'1px solid #e5e7eb', borderRadius:5, padding:'4px 9px', fontSize:11, cursor:'pointer', color:'#6b7280' }}>Edit</button>
                                {canDelete && (
                                  <button onClick={()=>deleteRisk(r.id)}
                                    style={{ background:'none', border:'none', color:'#d1d5db', cursor:'pointer', fontSize:14, padding:'0 3px' }}>✕</button>
                                )}
                              </div>
                            )}
                          </div>
                          {r.description && <div style={{ fontSize:12, color:'#374151', lineHeight:1.5, marginTop:4 }}>{r.description}</div>}
                          {r.mitigation && (
                            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:'7px 10px', marginTop:8, fontSize:12, color:'#15803d' }}>
                              <span style={{ fontWeight:700 }}>Mitigation: </span>{r.mitigation}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── ACTIVITY TAB ── */}
            {detailTab === 'activity' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto' }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:16 }}>Project Activity</div>
                {!activityLoaded && <div style={{ color:'#94a3b8', fontSize:13, textAlign:'center', paddingTop:20 }}>Loading…</div>}
                {activityLoaded && activityFeed.length === 0 && (
                  <div style={{ color:'#9ca3af', fontSize:13, textAlign:'center', paddingTop:30 }}>No activity recorded yet.</div>
                )}
                {activityLoaded && activityFeed.length > 0 && (() => {
                  const groups: { date: string; events: ProjectActivity[] }[] = []
                  activityFeed.forEach(ev => {
                    const d = new Date(ev.created_at).toLocaleDateString('en-GB', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
                    const last = groups[groups.length - 1]
                    if (last && last.date === d) last.events.push(ev)
                    else groups.push({ date: d, events: [ev] })
                  })
                  return (
                    <div style={{ display:'flex', flexDirection:'column', gap:22 }}>
                      {groups.map(g => (
                        <div key={g.date}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10, paddingBottom:6, borderBottom:'1px solid #f3f4f6' }}>{g.date}</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                            {g.events.map(ev => (
                              <div key={ev.id} style={{ display:'flex', gap:12, alignItems:'flex-start', padding:'8px 10px', borderRadius:7, background:'white', border:'1px solid #f3f4f6' }}>
                                <div style={{ width:7, height:7, borderRadius:'50%', background:'#d1d5db', marginTop:5, flexShrink:0 }} />
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, color:'#374151', lineHeight:'1.4' }}>{ev.description}</div>
                                  <div style={{ fontSize:11, color:'#9ca3af', marginTop:2 }}>
                                    {new Date(ev.created_at).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── GANTT TAB ── */}
            {detailTab === 'gantt' && (
              <div style={{ padding:'18px 22px', flex:1, overflowY:'auto' }}>
                <div style={{ fontSize:15, fontWeight:700, color:'#111827', marginBottom:4 }}>Gantt Chart</div>
                {active.milestones.some(m => m.amount > 0) && (
                  <div style={{ fontSize:12, color:'#6b7280', marginBottom:16 }}>
                    Total Investment: <strong>KES {active.milestones.reduce((s,m)=>s+(m.amount||0),0).toLocaleString()}</strong>
                    {' · '}{active.milestones.filter(m=>m.status==='completed').length}/{active.milestones.length} phases complete
                  </div>
                )}
                <GanttChart
                  milestones={active.milestones}
                  projectStart={active.start_date}
                  projectEnd={active.end_date}
                />
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
                              onClick={()=>canEdit&&setMilestoneStatus(ms, done?'pending':'completed')}
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

      {/* ── CONVERT ACTION POINT → TASK MODAL ── */}
      {convertModal && active && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={()=>setConvertModal(null)}>
          <div style={{ background:'white', borderRadius:12, padding:26, maxWidth:500, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)', maxHeight:'90vh', overflowY:'auto' }}
            onClick={e=>e.stopPropagation()}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'#0f172a' }}>Convert to Task</div>
              <button onClick={()=>setConvertModal(null)} style={{ background:'none', border:'none', fontSize:20, color:'#9ca3af', cursor:'pointer' }}>✕</button>
            </div>

            {/* Source action point */}
            <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:7, padding:'8px 11px', fontSize:12, color:'#166534', marginBottom:16, lineHeight:1.5 }}>
              <strong>Action point:</strong> {convertModal.actionText}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={lbl}>Task Description *</label>
                <textarea value={convertForm.particulars} onChange={e=>setConvertForm(f=>({...f,particulars:e.target.value}))}
                  rows={3} autoFocus
                  style={{ ...inp, resize:'vertical' }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:11 }}>
                <div>
                  <label style={lbl}>Assignee</label>
                  <select value={convertForm.responsible} onChange={e=>setConvertForm(f=>({...f,responsible:e.target.value}))} style={inp}>
                    <option value="">— none —</option>
                    {[...PEOPLE].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Priority</label>
                  <select value={convertForm.priority} onChange={e=>setConvertForm(f=>({...f,priority:e.target.value as 'low'|'medium'|'high'}))} style={inp}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={lbl}>Due Date</label>
                <input type="date" value={convertForm.due_date} onChange={e=>setConvertForm(f=>({...f,due_date:e.target.value}))} style={inp}/>
              </div>
              <div style={{ background:'#f3f4f6', borderRadius:6, padding:'7px 10px', fontSize:11, color:'#6b7280' }}>
                Project: <strong>{active.name}</strong> · Company: <strong>{active.company}</strong> · Category: Projects
              </div>
              {convertError && (
                <div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:6, padding:'8px 11px', fontSize:12, color:'#dc2626' }}>{convertError}</div>
              )}
            </div>
            <div style={{ display:'flex', gap:9, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={()=>setConvertModal(null)} style={{ background:'#f3f4f6', color:'#374151', border:'none', padding:'8px 16px', borderRadius:6, fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={submitConvertToTask} disabled={convertSaving||!convertForm.particulars.trim()}
                style={{ background:convertSaving||!convertForm.particulars.trim()?'#9ca3af':'#1a3a2a', color:'white', border:'none', padding:'8px 20px', borderRadius:6, fontSize:13, fontWeight:600, cursor:convertSaving||!convertForm.particulars.trim()?'not-allowed':'pointer' }}>
                {convertSaving?'Creating…':'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
