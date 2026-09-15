'use client'

import { useState, useEffect, useCallback } from 'react'
import type { TrackerProject, TrackerMilestone, TrackerUpdate, TrackerMeeting, TrackerUpdateComment } from '@/lib/tracker'
import type { SessionUser } from '@/types'
import { COMPANIES, PEOPLE } from '@/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const RAG: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  'green':   { bg: '#dcfce7', color: '#15803d', dot: '#16a34a', label: 'Green' },
  'amber':   { bg: '#fef3c7', color: '#b45309', dot: '#d97706', label: 'Amber' },
  'red':     { bg: '#fee2e2', color: '#dc2626', dot: '#ef4444', label: 'Red' },
  'not-set': { bg: '#f3f4f6', color: '#6b7280', dot: '#d1d5db', label: 'Not Set' },
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:    { bg: '#dcfce7', color: '#15803d' },
  planning:  { bg: '#dbeafe', color: '#1d4ed8' },
  'on-hold': { bg: '#fef3c7', color: '#b45309' },
  completed: { bg: '#f3f4f6', color: '#374151' },
}

const UPDATE_TYPE: Record<string, { label: string; bg: string; color: string }> = {
  progress:  { label: 'Progress',  bg: '#dbeafe', color: '#1d4ed8' },
  action:    { label: 'Action',    bg: '#fef3c7', color: '#b45309' },
  decision:  { label: 'Decision',  bg: '#ede9fe', color: '#7c3aed' },
  blocker:   { label: 'Blocker',   bg: '#fee2e2', color: '#dc2626' },
}

const UPDATE_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  open:        { label: 'Open',        bg: '#f3f4f6', color: '#6b7280' },
  in_progress: { label: 'In Progress', bg: '#fef3c7', color: '#b45309' },
  done:        { label: 'Done',        bg: '#dcfce7', color: '#15803d' },
}

const MS_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be185d']

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtShort(d: string) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function timeAgo(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function initials(name: string) {
  return name.split(/[\s.]+/).map(w => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}

function msProgress(milestones: TrackerMilestone[]): number {
  if (!milestones.length) return 0
  return Math.round((milestones.filter(m => m.status === 'completed').length / milestones.length) * 100)
}

// ── Gantt Chart ───────────────────────────────────────────────────────────────

function GanttChart({ milestones, projectStart, projectEnd }: {
  milestones: TrackerMilestone[]
  projectStart: string
  projectEnd: string
}) {
  const start = projectStart ? new Date(projectStart + 'T00:00:00').getTime() : Date.now() - 30 * 86400000
  const end   = projectEnd   ? new Date(projectEnd   + 'T00:00:00').getTime() : Date.now() + 60 * 86400000
  const span  = end - start || 1

  const today = Date.now()
  const todayPct = Math.max(0, Math.min(100, ((today - start) / span) * 100))

  if (!milestones.length) return (
    <div style={{ padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      No milestones added yet. Add milestones to see the Gantt chart.
    </div>
  )

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 600, position: 'relative' }}>
        {/* Month labels */}
        <div style={{ display: 'flex', marginBottom: 8, paddingLeft: 160 }}>
          {Array.from({ length: 6 }, (_, i) => {
            const d = new Date(start + (span / 6) * i)
            return (
              <div key={i} style={{ flex: 1, fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>
                {d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
              </div>
            )
          })}
        </div>

        {/* Today line */}
        <div style={{ position: 'absolute', left: `calc(160px + ${todayPct}% * (100% - 160px) / 100)`, top: 24, bottom: 0, width: 1, background: '#ef4444', zIndex: 2 }}>
          <div style={{ position: 'absolute', top: -16, left: -14, fontSize: 9, fontWeight: 700, color: '#ef4444', background: '#fee2e2', padding: '1px 5px', borderRadius: 4 }}>TODAY</div>
        </div>

        {/* Milestone rows */}
        {milestones.map(ms => {
          const msStart = ms.start_date ? new Date(ms.start_date + 'T00:00:00').getTime() : start
          const msEnd   = ms.end_date   ? new Date(ms.end_date   + 'T00:00:00').getTime() : msStart + 7 * 86400000
          const left  = Math.max(0, ((msStart - start) / span) * 100)
          const width = Math.max(1, ((msEnd - msStart) / span) * 100)

          return (
            <div key={ms.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ width: 152, flexShrink: 0, fontSize: 12, color: '#374151', fontWeight: 500, paddingRight: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={ms.title}>
                {ms.title}
              </div>
              <div style={{ flex: 1, background: '#f9fafb', borderRadius: 4, height: 24, position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: `${left}%`, width: `${Math.min(width, 100 - left)}%`,
                  height: '100%', background: ms.status === 'completed' ? '#16a34a' : ms.color,
                  borderRadius: 4, opacity: ms.status === 'completed' ? 1 : 0.8,
                  display: 'flex', alignItems: 'center', paddingLeft: 6,
                }}>
                  <span style={{ fontSize: 9, color: 'white', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                    {ms.status === 'completed' ? '✓ ' : ''}{fmtShort(ms.start_date)} – {fmtShort(ms.end_date)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Update Row ────────────────────────────────────────────────────────────────

function UpdateRow({ u, onStatusChange, onDelete, onComment, refresh }: {
  u: TrackerUpdate
  onStatusChange: (id: number, status: string) => void
  onDelete: (id: number) => void
  onComment: (updateId: number, body: string) => void
  refresh: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [comment, setComment] = useState('')
  const t = UPDATE_TYPE[u.update_type] ?? UPDATE_TYPE.progress
  const s = UPDATE_STATUS[u.status] ?? UPDATE_STATUS.open

  const statuses = Object.entries(UPDATE_STATUS)

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}>
        <td style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmt(u.update_date)}</td>
        <td style={{ padding: '10px 8px' }}>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: t.bg, color: t.color }}>{t.label}</span>
        </td>
        <td style={{ padding: '10px 8px', fontSize: 12, color: '#111827', maxWidth: 240 }}>
          <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{u.body}</div>
        </td>
        <td style={{ padding: '10px 8px', fontSize: 12, color: '#374151', maxWidth: 180 }}>
          <div style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{u.next_steps || '—'}</div>
        </td>
        <td style={{ padding: '10px 8px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{u.owner || '—'}</td>
        <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
          <select value={u.status} onChange={e => onStatusChange(u.id, e.target.value)}
            style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 10, border: 'none', background: s.bg, color: s.color, cursor: 'pointer', outline: 'none' }}>
            {statuses.map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </td>
        <td style={{ padding: '10px 8px', fontSize: 11, color: '#9ca3af' }}>{u.posted_by}</td>
        <td style={{ padding: '10px 8px' }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setExpanded(e => !e)}
              style={{ fontSize: 10, background: u.comments.length ? '#ede9fe' : '#f3f4f6', color: u.comments.length ? '#7c3aed' : '#9ca3af', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer', fontWeight: 600 }}>
              💬 {u.comments.length || ''}
            </button>
            <button onClick={() => onDelete(u.id)}
              style={{ fontSize: 10, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 10, padding: '2px 8px', cursor: 'pointer' }}>✕</button>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} style={{ padding: 0, background: '#fafafa' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
              {/* Full content */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Update</div>
                  <div style={{ fontSize: 13, color: '#111827', whiteSpace: 'pre-wrap' }}>{u.body}</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>Actions / Next Steps</div>
                  <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{u.next_steps || '—'}</div>
                </div>
              </div>

              {/* Remarks thread */}
              <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>
                  Remarks {u.comments.length > 0 && `(${u.comments.length})`}
                </div>
                {u.comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#1a3a2a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, flexShrink: 0 }}>
                      {initials(c.posted_by)}
                    </div>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{c.posted_by}</span>
                      <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 6 }}>{timeAgo(c.created_at)}</span>
                      <div style={{ fontSize: 12, color: '#111827', marginTop: 2 }}>{c.body}</div>
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <textarea value={comment} onChange={e => setComment(e.target.value)}
                    placeholder="Add a remark…"
                    onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && comment.trim()) { onComment(u.id, comment.trim()); setComment(''); refresh() } }}
                    style={{ flex: 1, fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', resize: 'none', height: 56, fontFamily: 'inherit' }} />
                  <button onClick={() => { if (comment.trim()) { onComment(u.id, comment.trim()); setComment(''); refresh() } }}
                    style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 6, padding: '0 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                    Send
                  </button>
                </div>
                <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>Ctrl+Enter to submit</div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props { initialProjects: TrackerProject[]; currentUser: SessionUser }

export default function TrackerBoard({ initialProjects, currentUser }: Props) {
  const [projects, setProjects] = useState<TrackerProject[]>(initialProjects)
  const [selected, setSelected] = useState<number | null>(initialProjects[0]?.id ?? null)
  const [tab, setTab] = useState<'overview' | 'updates' | 'meetings'>('overview')

  // Project detail data
  const [updates,  setUpdates]  = useState<TrackerUpdate[]>([])
  const [meetings, setMeetings] = useState<TrackerMeeting[]>([])

  // Modals / forms
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewMilestone, setShowNewMilestone] = useState(false)
  const [showNewUpdate, setShowNewUpdate] = useState(false)
  const [showNewMeeting, setShowNewMeeting] = useState(false)

  // Forms
  const today = new Date().toISOString().slice(0, 10)
  const [projForm, setProjForm] = useState({ name:'', description:'', company:'', owner:'', status:'active', rag_status:'not-set', start_date:'', end_date:'' })
  const [msForm, setMsForm] = useState({ title:'', start_date:'', end_date:'', status:'pending', color: MS_COLORS[0] })
  const [updForm, setUpdForm] = useState({ update_type:'progress', body:'', next_steps:'', owner:'', update_date: today })
  const [mtgForm, setMtgForm] = useState({ title:'', meeting_date: today, attendees:'', agenda:'', notes:'', action_points:'' })

  const proj = projects.find(p => p.id === selected) ?? null

  const loadUpdates = useCallback(async (pid: number) => {
    const res = await fetch(`/api/tracker/projects/${pid}/updates`, { credentials: 'include' })
    if (res.ok) setUpdates(await res.json())
  }, [])

  const loadMeetings = useCallback(async (pid: number) => {
    const res = await fetch(`/api/tracker/projects/${pid}/meetings`, { credentials: 'include' })
    if (res.ok) setMeetings(await res.json())
  }, [])

  const loadProjects = useCallback(async () => {
    const res = await fetch('/api/tracker/projects', { credentials: 'include' })
    if (res.ok) setProjects(await res.json())
  }, [])

  useEffect(() => {
    if (!selected) return
    if (tab === 'updates') loadUpdates(selected)
    if (tab === 'meetings') loadMeetings(selected)
  }, [selected, tab, loadUpdates, loadMeetings])

  // ── Actions ────────────────────────────────────────────────────────────────

  async function createProject() {
    if (!projForm.name.trim()) return
    const res = await fetch('/api/tracker/projects', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(projForm) })
    if (res.ok) {
      const p: TrackerProject = await res.json()
      setProjects(prev => [p, ...prev])
      setSelected(p.id)
      setShowNewProject(false)
      setProjForm({ name:'', description:'', company:'', owner:'', status:'active', rag_status:'not-set', start_date:'', end_date:'' })
    }
  }

  async function deleteProject(id: number) {
    if (!confirm('Delete this project and all its data?')) return
    await fetch(`/api/tracker/projects/${id}`, { method: 'DELETE', credentials: 'include' })
    setProjects(prev => prev.filter(p => p.id !== id))
    if (selected === id) setSelected(projects.find(p => p.id !== id)?.id ?? null)
  }

  async function updateRAG(id: number, rag_status: string) {
    await fetch(`/api/tracker/projects/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rag_status }) })
    setProjects(prev => prev.map(p => p.id === id ? { ...p, rag_status } : p))
  }

  async function createMilestone() {
    if (!msForm.title.trim() || !selected) return
    const res = await fetch(`/api/tracker/projects/${selected}/milestones`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msForm) })
    if (res.ok) {
      await loadProjects()
      setShowNewMilestone(false)
      setMsForm({ title:'', start_date:'', end_date:'', status:'pending', color: MS_COLORS[0] })
    }
  }

  async function toggleMilestone(ms: TrackerMilestone) {
    const status = ms.status === 'completed' ? 'pending' : 'completed'
    await fetch(`/api/tracker/milestones/${ms.id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    await loadProjects()
  }

  async function deleteMilestone(id: number) {
    await fetch(`/api/tracker/milestones/${id}`, { method: 'DELETE', credentials: 'include' })
    await loadProjects()
  }

  async function createUpdate() {
    if (!updForm.body.trim() || !selected) return
    const res = await fetch(`/api/tracker/projects/${selected}/updates`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updForm) })
    if (res.ok) {
      await loadUpdates(selected)
      setShowNewUpdate(false)
      setUpdForm({ update_type:'progress', body:'', next_steps:'', owner:'', update_date: today })
    }
  }

  async function setUpdateStatus(id: number, status: string) {
    await fetch(`/api/tracker/updates/${id}/status`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    setUpdates(prev => prev.map(u => u.id === id ? { ...u, status } : u))
  }

  async function deleteUpdate(id: number) {
    if (!confirm('Delete this update?')) return
    await fetch(`/api/tracker/updates/${id}`, { method: 'DELETE', credentials: 'include' })
    setUpdates(prev => prev.filter(u => u.id !== id))
  }

  async function addComment(updateId: number, body: string) {
    const res = await fetch(`/api/tracker/updates/${updateId}/comments`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) })
    if (res.ok) {
      const c: TrackerUpdateComment = await res.json()
      setUpdates(prev => prev.map(u => u.id === updateId ? { ...u, comments: [...u.comments, c] } : u))
    }
  }

  async function createMeeting() {
    if (!mtgForm.title.trim() || !selected) return
    const res = await fetch(`/api/tracker/projects/${selected}/meetings`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(mtgForm) })
    if (res.ok) {
      await loadMeetings(selected)
      setShowNewMeeting(false)
      setMtgForm({ title:'', meeting_date: today, attendees:'', agenda:'', notes:'', action_points:'' })
    }
  }

  async function deleteMeeting(id: number) {
    if (!confirm('Delete this meeting?')) return
    await fetch(`/api/tracker/meetings/${id}`, { method: 'DELETE', credentials: 'include' })
    setMeetings(prev => prev.filter(m => m.id !== id))
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 4 }
  const inp: React.CSSProperties = { width: '100%', fontSize: 13, border: '1px solid #d1d5db', borderRadius: 6, padding: '7px 10px', fontFamily: 'inherit', boxSizing: 'border-box' }
  const btn = (bg: string, color = 'white'): React.CSSProperties => ({ background: bg, color, border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' })
  const tab_s = (active: boolean): React.CSSProperties => ({
    fontSize: 13, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', border: 'none',
    background: active ? '#1a3a2a' : 'transparent', color: active ? 'white' : '#6b7280', borderRadius: 6,
  })

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#1a3a2a', padding: '0 24px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 12 }}>← Hub</a>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>📊 Project Tracker</span>
        </div>
        <button onClick={() => setShowNewProject(true)} style={btn('#b5833a')}>+ New Project</button>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 52px)' }}>

        {/* Sidebar — project list */}
        <div style={{ width: 280, flexShrink: 0, background: 'white', borderRight: '1px solid #e5e7eb', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px' }}>
            {projects.length} Project{projects.length !== 1 ? 's' : ''}
          </div>
          {projects.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No projects yet.<br />Click + New Project to start.</div>
          )}
          {projects.map(p => {
            const r = RAG[p.rag_status] ?? RAG['not-set']
            const pct = msProgress(p.milestones ?? [])
            const isActive = p.id === selected
            return (
              <div key={p.id} onClick={() => { setSelected(p.id); setTab('overview') }}
                style={{ padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid #f9fafb', borderLeft: `3px solid ${isActive ? '#1a3a2a' : 'transparent'}`, background: isActive ? '#f0fdf4' : 'transparent', transition: 'background .1s' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', lineHeight: 1.3 }}>{p.name}</div>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.dot, flexShrink: 0, marginTop: 3 }} />
                </div>
                {p.company && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{p.company}</div>}
                {/* Progress bar */}
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>{(p.milestones ?? []).filter(m => m.status === 'completed').length}/{(p.milestones ?? []).length} milestones</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: pct === 100 ? '#15803d' : '#6b7280' }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#16a34a' : '#1a3a2a', borderRadius: 2, transition: 'width .3s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Main detail area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {!proj ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9ca3af', fontSize: 14 }}>
              Select a project or create one to get started.
            </div>
          ) : (
            <>
              {/* Project header */}
              <div style={{ ...card, padding: '20px 24px', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#111827' }}>{proj.name}</h1>
                    {proj.description && <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>{proj.description}</p>}
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                      {proj.owner && <span style={{ fontSize: 12, color: '#374151' }}>👤 {proj.owner}</span>}
                      {proj.company && <span style={{ fontSize: 12, color: '#374151' }}>🏢 {proj.company}</span>}
                      {proj.start_date && <span style={{ fontSize: 12, color: '#374151' }}>📅 {fmt(proj.start_date)} – {fmt(proj.end_date)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* RAG selector */}
                    <select value={proj.rag_status} onChange={e => updateRAG(proj.id, e.target.value)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10, border: 'none', background: RAG[proj.rag_status]?.bg || '#f3f4f6', color: RAG[proj.rag_status]?.color || '#6b7280', cursor: 'pointer', outline: 'none' }}>
                      {Object.entries(RAG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10, background: STATUS_STYLE[proj.status]?.bg || '#f3f4f6', color: STATUS_STYLE[proj.status]?.color || '#374151' }}>
                      {proj.status.replace('-', ' ')}
                    </span>
                    <button onClick={() => deleteProject(proj.id)} style={{ ...btn('#fee2e2', '#dc2626'), padding: '4px 10px', fontSize: 11 }}>Delete</button>
                  </div>
                </div>

                {/* Progress */}
                {(proj.milestones ?? []).length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>MILESTONE PROGRESS</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#111827' }}>{msProgress(proj.milestones ?? [])}%</span>
                    </div>
                    <div style={{ height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${msProgress(proj.milestones ?? [])}%`, background: '#1a3a2a', borderRadius: 4, transition: 'width .4s' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'white', borderRadius: 8, padding: 4, border: '1px solid #e5e7eb', width: 'fit-content' }}>
                {(['overview','updates','meetings'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} style={tab_s(tab === t)}>
                    {t === 'overview' ? '📐 Overview' : t === 'updates' ? '📋 Updates' : '🗓 Meetings'}
                  </button>
                ))}
              </div>

              {/* ── OVERVIEW TAB ── */}
              {tab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {/* Gantt */}
                  <div style={card}>
                    <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Gantt Chart</span>
                      <button onClick={() => setShowNewMilestone(true)} style={btn('#1a3a2a')}>+ Milestone</button>
                    </div>
                    <div style={{ padding: '16px 20px' }}>
                      <GanttChart milestones={proj.milestones ?? []} projectStart={proj.start_date} projectEnd={proj.end_date} />
                    </div>
                  </div>

                  {/* Milestone list */}
                  {(proj.milestones ?? []).length > 0 && (
                    <div style={card}>
                      <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Milestones</span>
                      </div>
                      <div>
                        {(proj.milestones ?? []).map(ms => (
                          <div key={ms.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f9fafb' }}>
                            <div style={{ width: 10, height: 10, borderRadius: '50%', background: ms.status === 'completed' ? '#16a34a' : ms.color, flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, color: '#111827', fontWeight: 500, textDecoration: ms.status === 'completed' ? 'line-through' : 'none' }}>{ms.title}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>{fmt(ms.start_date)} – {fmt(ms.end_date)}</span>
                            <button onClick={() => toggleMilestone(ms)}
                              style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: ms.status === 'completed' ? '#dcfce7' : '#f3f4f6', color: ms.status === 'completed' ? '#15803d' : '#6b7280' }}>
                              {ms.status === 'completed' ? '✓ Done' : 'Mark Done'}
                            </button>
                            <button onClick={() => deleteMilestone(ms.id)} style={{ fontSize: 11, background: 'none', border: 'none', color: '#d1d5db', cursor: 'pointer' }}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── UPDATES TAB ── */}
              {tab === 'updates' && (
                <div style={card}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Project Updates</span>
                    <button onClick={() => setShowNewUpdate(true)} style={btn('#1a3a2a')}>+ Add Update</button>
                  </div>

                  {showNewUpdate && (
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={lbl}>Date</label>
                          <input type="date" value={updForm.update_date} onChange={e => setUpdForm(f => ({ ...f, update_date: e.target.value }))} style={inp} />
                        </div>
                        <div>
                          <label style={lbl}>Type</label>
                          <select value={updForm.update_type} onChange={e => setUpdForm(f => ({ ...f, update_type: e.target.value }))} style={inp}>
                            {Object.entries(UPDATE_TYPE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={lbl}>Owner</label>
                          <select value={updForm.owner} onChange={e => setUpdForm(f => ({ ...f, owner: e.target.value }))} style={inp}>
                            <option value="">—</option>
                            {[...PEOPLE].map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={lbl}>Update *</label>
                          <textarea value={updForm.body} onChange={e => setUpdForm(f => ({ ...f, body: e.target.value }))} placeholder="What happened, what was decided…" style={{ ...inp, height: 80, resize: 'vertical' }} />
                        </div>
                        <div>
                          <label style={lbl}>Actions / Next Steps</label>
                          <textarea value={updForm.next_steps} onChange={e => setUpdForm(f => ({ ...f, next_steps: e.target.value }))} placeholder="What needs to happen next…" style={{ ...inp, height: 80, resize: 'vertical' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={createUpdate} style={btn('#1a3a2a')}>Save Update</button>
                        <button onClick={() => setShowNewUpdate(false)} style={btn('#f3f4f6', '#374151')}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {updates.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No updates yet. Click + Add Update to start tracking progress.</div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                        <thead>
                          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                            {['Date','Type','Update','Actions / Next Steps','Owner','Status','Posted By',''].map(h => (
                              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '.5px' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {updates.map(u => (
                            <UpdateRow key={u.id} u={u}
                              onStatusChange={setUpdateStatus}
                              onDelete={deleteUpdate}
                              onComment={addComment}
                              refresh={() => loadUpdates(selected!)}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── MEETINGS TAB ── */}
              {tab === 'meetings' && (
                <div style={card}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '.05em' }}>Meeting Log</span>
                    <button onClick={() => setShowNewMeeting(true)} style={btn('#1a3a2a')}>+ Log Meeting</button>
                  </div>

                  {showNewMeeting && (
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={lbl}>Meeting Title *</label>
                          <input value={mtgForm.title} onChange={e => setMtgForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Weekly Sync, Board Review…" style={inp} />
                        </div>
                        <div>
                          <label style={lbl}>Date</label>
                          <input type="date" value={mtgForm.meeting_date} onChange={e => setMtgForm(f => ({ ...f, meeting_date: e.target.value }))} style={inp} />
                        </div>
                        <div>
                          <label style={lbl}>Attendees</label>
                          <input value={mtgForm.attendees} onChange={e => setMtgForm(f => ({ ...f, attendees: e.target.value }))} placeholder="Paul, Harshil, Benson…" style={inp} />
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div>
                          <label style={lbl}>Agenda</label>
                          <textarea value={mtgForm.agenda} onChange={e => setMtgForm(f => ({ ...f, agenda: e.target.value }))} placeholder="Topics discussed…" style={{ ...inp, height: 80, resize: 'vertical' }} />
                        </div>
                        <div>
                          <label style={lbl}>Notes / Minutes</label>
                          <textarea value={mtgForm.notes} onChange={e => setMtgForm(f => ({ ...f, notes: e.target.value }))} placeholder="Key points from the meeting…" style={{ ...inp, height: 80, resize: 'vertical' }} />
                        </div>
                        <div>
                          <label style={lbl}>Action Points</label>
                          <textarea value={mtgForm.action_points} onChange={e => setMtgForm(f => ({ ...f, action_points: e.target.value }))} placeholder="Follow-up tasks agreed…" style={{ ...inp, height: 80, resize: 'vertical' }} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={createMeeting} style={btn('#1a3a2a')}>Save Meeting</button>
                        <button onClick={() => setShowNewMeeting(false)} style={btn('#f3f4f6', '#374151')}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {meetings.length === 0 ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No meetings logged yet.</div>
                  ) : (
                    <div>
                      {meetings.map(m => (
                        <MeetingCard key={m.id} m={m} onDelete={deleteMeeting} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── New Project Modal ── */}
      {showNewProject && (
        <Modal title="New Project" onClose={() => setShowNewProject(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Project Name *</label>
              <input value={projForm.name} onChange={e => setProjForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter project name…" style={inp} autoFocus />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Description</label>
              <textarea value={projForm.description} onChange={e => setProjForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description…" style={{ ...inp, height: 64, resize: 'vertical' }} />
            </div>
            <div>
              <label style={lbl}>Company</label>
              <select value={projForm.company} onChange={e => setProjForm(f => ({ ...f, company: e.target.value }))} style={inp}>
                <option value="">—</option>
                {[...COMPANIES].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Owner</label>
              <select value={projForm.owner} onChange={e => setProjForm(f => ({ ...f, owner: e.target.value }))} style={inp}>
                <option value="">—</option>
                {[...PEOPLE].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Start Date</label>
              <input type="date" value={projForm.start_date} onChange={e => setProjForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>End Date</label>
              <input type="date" value={projForm.end_date} onChange={e => setProjForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select value={projForm.status} onChange={e => setProjForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label style={lbl}>RAG Status</label>
              <select value={projForm.rag_status} onChange={e => setProjForm(f => ({ ...f, rag_status: e.target.value }))} style={inp}>
                {Object.entries(RAG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={createProject} style={btn('#1a3a2a')}>Create Project</button>
            <button onClick={() => setShowNewProject(false)} style={btn('#f3f4f6', '#374151')}>Cancel</button>
          </div>
        </Modal>
      )}

      {/* ── New Milestone Modal ── */}
      {showNewMilestone && (
        <Modal title="Add Milestone" onClose={() => setShowNewMilestone(false)}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Title *</label>
              <input value={msForm.title} onChange={e => setMsForm(f => ({ ...f, title: e.target.value }))} placeholder="Milestone title…" style={inp} autoFocus />
            </div>
            <div>
              <label style={lbl}>Start Date</label>
              <input type="date" value={msForm.start_date} onChange={e => setMsForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>End Date</label>
              <input type="date" value={msForm.end_date} onChange={e => setMsForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={lbl}>Status</label>
              <select value={msForm.status} onChange={e => setMsForm(f => ({ ...f, status: e.target.value }))} style={inp}>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Bar Color</label>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                {MS_COLORS.map(c => (
                  <button key={c} onClick={() => setMsForm(f => ({ ...f, color: c }))}
                    style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: msForm.color === c ? '3px solid #111827' : '2px solid transparent', cursor: 'pointer' }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button onClick={createMilestone} style={btn('#1a3a2a')}>Add Milestone</button>
            <button onClick={() => setShowNewMilestone(false)} style={btn('#f3f4f6', '#374151')}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── Meeting Card ──────────────────────────────────────────────────────────────

function MeetingCard({ m, onDelete }: { m: TrackerMeeting; onDelete: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false)

  function fmt(d: string) {
    if (!d) return '—'
    return new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', cursor: 'pointer' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🗓</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#111827' }}>{m.title}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
            {fmt(m.meeting_date)}
            {m.attendees && ` · ${m.attendees}`}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(m.id) }}
          style={{ fontSize: 11, background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>Delete</button>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '0 20px 16px 20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            {[['Agenda', m.agenda], ['Notes / Minutes', m.notes], ['Action Points', m.action_points]].map(([label, value]) => (
              value ? (
                <div key={label as string}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', background: '#f9fafb', borderRadius: 6, padding: '8px 10px' }}>{value}</div>
                </div>
              ) : null
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#9ca3af' }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}
