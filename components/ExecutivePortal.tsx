'use client'

import { useState, useEffect, useRef } from 'react'
import { SessionUser } from '@/types'
import NotificationBell from './NotificationBell'

// ── Design tokens ──────────────────────────────────────────────────────────
const T = {
  bg:       '#060c08',
  card:     '#0b1610',
  card2:    '#0f1c13',
  border:   '#162214',
  border2:  '#1e2e1a',
  text:     '#e2ede7',
  text2:    '#7aaa87',
  text3:    '#4a7055',
  green:    '#22c55e',
  greenDim: '#16a34a',
  amber:    '#f59e0b',
  red:      '#ef4444',
  gold:     '#b5833a',
  blue:     '#60a5fa',
}

// ── Escalation type config ─────────────────────────────────────────────────
const TYPE_CFG: Record<string, { tag: string; action: string; color: string; bg: string; border: string }> = {
  decision: { tag: 'DECISION REQUIRED',   action: 'Decide',  color: T.red,   bg: `${T.red}18`,   border: `${T.red}33`   },
  action:   { tag: 'EXECUTIVE ESCALATION',action: 'Approve', color: T.amber, bg: `${T.amber}18`, border: `${T.amber}33` },
  guidance: { tag: 'MANAGEMENT GUIDANCE', action: 'Comment', color: T.blue,  bg: `${T.blue}18`,  border: `${T.blue}33`  },
  info:     { tag: 'FOR AWARENESS',       action: 'View',    color: T.text2, bg: `${T.border}88`, border: T.border2      },
  none:     { tag: 'AWAITING APPROVAL',   action: 'Approve', color: T.amber, bg: `${T.amber}18`, border: `${T.amber}33` },
}

// ── Types ──────────────────────────────────────────────────────────────────
interface HKAttentionTask {
  id: string; particulars: string; company: string; section: string
  responsible: string; status: string; priority: string
  hk_escalation_type: string; hk_escalation_note: string; hk_escalation_by: string
  latest_update: string | null; days_waiting: string
}
interface WorkloadRow { responsible: string; open: string; resolved_week: string }
interface Activity    { user_name: string; action: string; details: string; created_at: string }
interface HealthItem  { name: string; score: number; color: string; label: string; detail: string }

interface ExecData {
  today: string
  totalOpen: number; actionRequired: number; needsHkComment: number
  awaitingApproval: number; resolvedToday: number
  oldestDays: number; avgWaitDays: number
  pcrActive: number; pcrHighValue: number; leavePending: number
  dnTotal: number; dnCancelled: number
  activityFeed: Activity[]; workload: WorkloadRow[]
  // new HK-specific fields
  hkAttentionTasks: HKAttentionTask[]
  needsDecision: number; awaitingInput: number; forAwareness: number
  resolvedThisWeek: number; escalatedThisWeek: number
  pendingCount: number; longRunningCount: number
}

// ── Helpers ────────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}
function fmtDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function fmtRelative(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs  > 0) return `${hrs}h ago`
  if (mins > 0) return `${mins}m ago`
  return 'just now'
}

function generateBriefing(data: ExecData): string {
  const total = data.needsDecision + data.awaitingInput + data.forAwareness
  if (total === 0) return 'Operations are running smoothly today. No executive action is required at this time — the team is managing the queue effectively.'
  const parts: string[] = []
  if (data.needsDecision > 0) parts.push(`${data.needsDecision} matter${data.needsDecision !== 1 ? 's' : ''} require${data.needsDecision === 1 ? 's' : ''} your decision`)
  if (data.awaitingInput  > 0) parts.push(`${data.awaitingInput}  item${data.awaitingInput  !== 1 ? 's' : ''} await your input`)
  if (data.forAwareness   > 0) parts.push(`${data.forAwareness}   update${data.forAwareness !== 1 ? 's' : ''} for your awareness`)
  const intro = data.needsDecision > 0 ? 'Your attention is needed.' : 'Operations are generally stable.'
  return `${intro} ${parts.join(', ')}. Paul and the team are managing the remaining operational tasks.`
}

function generateWeeklyReview(data: ExecData): { summary: string; recommendation: string } {
  const { resolvedThisWeek: r, escalatedThisWeek: e, longRunningCount: l } = data
  const summary =
    `${r} task${r !== 1 ? 's' : ''} were completed across the organisation this week` +
    (e > 0 ? `, and ${e} matter${e !== 1 ? 's' : ''} were escalated to you` : '') + '. ' +
    (l > 0
      ? `${l} task${l !== 1 ? 's' : ''} have been open for more than 30 days and may require intervention.`
      : 'No long-standing items of concern this week.')
  const recommendation = l > 2
    ? `Review the ${l} long-running matters — some may be stalled and need a decision to unblock the team.`
    : e > 0
    ? `Your escalated items are the priority. Once addressed, the operational queue should move efficiently.`
    : r > 5
    ? 'Strong completion rate this week. No immediate intervention required — operations are progressing normally.'
    : 'No immediate intervention required. Continue monitoring the escalation queue.'
  return { summary, recommendation }
}

function computeHealth(data: ExecData): HealthItem[] {
  const totalOpen = data.totalOpen || 1
  const actionRatio = data.actionRequired / totalOpen
  const hkRatio     = data.needsHkComment / totalOpen
  const taskScore   = Math.max(5, Math.round(
    100 - (actionRatio * 35) - (hkRatio * 50)
    - (data.avgWaitDays  > 14 ? 15 : data.avgWaitDays  > 7 ? 8 : 0)
    - (data.oldestDays   > 60 ? 10 : data.oldestDays   > 30 ? 5 : 0)
  ))
  const leaveScore = data.leavePending === 0 ? 95 : data.leavePending > 8 ? 40 : data.leavePending > 4 ? 62 : data.leavePending > 1 ? 78 : 88
  const opens      = (data.workload ?? []).map(p => parseInt(p.open))
  const maxOpen    = opens.length ? Math.max(...opens) : 0
  const avgOpen    = opens.length ? opens.reduce((a, b) => a + b, 0) / opens.length : 1
  const imbalance  = avgOpen > 0 ? maxOpen / avgOpen : 1
  const heavyCnt   = opens.filter(o => o > 30).length
  const peopleScore = Math.max(5, Math.round(100
    - (imbalance > 5 ? 45 : imbalance > 3 ? 28 : imbalance > 2 ? 12 : 0)
    - (heavyCnt  > 3 ? 20 : heavyCnt  > 1 ? 12 : heavyCnt === 1 ? 6 : 0)
    - (maxOpen   > 60 ? 12 : maxOpen  > 40 ? 6 : 0)
  ))
  const col = (s: number) => s >= 75 ? T.green : s >= 50 ? T.amber : T.red
  const lbl = (s: number) => s >= 75 ? 'On Track' : s >= 50 ? 'At Risk' : 'Critical'
  return [
    { name: 'Operations', score: taskScore,   color: col(taskScore),   label: lbl(taskScore),   detail: `${data.actionRequired} tasks need action` },
    { name: 'People',     score: peopleScore, color: col(peopleScore), label: lbl(peopleScore), detail: heavyCnt > 0 ? `${heavyCnt} member${heavyCnt !== 1 ? 's' : ''} overloaded` : 'Workload balanced' },
    { name: 'Leave',      score: leaveScore,  color: col(leaveScore),  label: lbl(leaveScore),  detail: `${data.leavePending} request${data.leavePending !== 1 ? 's' : ''} pending` },
  ]
}

const ACTION_LABELS: Record<string, string> = {
  login: 'logged in', logout: 'logged out',
  task_created: 'created a task', task_status_changed: 'updated task status',
  task_update_posted: 'posted an update', task_commented: 'added HK comment',
  leave_submitted: 'submitted leave', pcr_submitted: 'submitted petty cash',
  leave_approved: 'approved leave', leave_rejected: 'rejected leave',
  petty_cash_hos_approved: 'approved PCR', petty_cash_disbursed: 'disbursed cash',
  doc_uploaded: 'uploaded document',
}

const SUGGESTED_QUESTIONS = [
  'What needs my attention today?',
  'What did we complete this week?',
  'What is overdue?',
  'Which tasks are waiting on me?',
  'What has Paul handled this week?',
  'Show me the biggest operational risks.',
]

async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

// ── Component ──────────────────────────────────────────────────────────────
export default function ExecutivePortal({ currentUser }: { currentUser: SessionUser }) {
  const [data,      setData]      = useState<ExecData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [isMobile,  setIsMobile]  = useState(false)
  const [navOpen,   setNavOpen]   = useState(false)
  const [userMenu,  setUserMenu]  = useState(false)
  // Password modal
  const [showPwModal, setShowPwModal] = useState(false)
  const [pwForm,      setPwForm]      = useState({ current: '', next: '', confirm: '' })
  const [pwError,     setPwError]     = useState('')
  const [pwSuccess,   setPwSuccess]   = useState(false)
  const [pwSaving,    setPwSaving]    = useState(false)
  // AI chat
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState<{ q: string; a: string }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)

  const firstName = currentUser.name.split(' ')[0]
  const initials  = currentUser.name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
  const isHK      = firstName.toLowerCase() === 'harshil'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/executive-portal', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  async function askAI(question: string) {
    if (!question.trim() || chatLoading) return
    setChatInput('')
    setChatLoading(true)
    try {
      const res = await fetch('/api/intelligence/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      })
      const d = await res.json()
      const answer = d.answer ?? d.error ?? 'No response.'
      setChatHistory(h => [...h.slice(-5), { q: question, a: answer }])
    } catch {
      setChatHistory(h => [...h.slice(-5), { q: question, a: 'Connection error. Please try again.' }])
    } finally {
      setChatLoading(false)
    }
  }

  const hkAttention  = data?.hkAttentionTasks ?? []
  const needsDecision = data?.needsDecision ?? 0
  const awaitingInput = data?.awaitingInput  ?? 0
  const forAwareness  = data?.forAwareness   ?? 0
  const totalItems    = needsDecision + awaitingInput + forAwareness
  const reviewMins    = Math.max(5, totalItems * 4)
  const health        = data ? computeHealth(data) : []
  const briefing      = data ? generateBriefing(data) : ''
  const weekReview    = data ? generateWeeklyReview(data) : { summary: '', recommendation: '' }
  const recentActivity = (data?.activityFeed ?? []).slice(0, 5)

  const card: React.CSSProperties = {
    background: T.card, borderRadius: 12, border: `1px solid ${T.border}`,
  }

  // ── Shared skeleton ────────────────────────────────────────────────────────
  function Skeleton({ width = '80%', height = 12 }: { width?: string; height?: number }) {
    return (
      <div style={{ height, borderRadius: 4, background: T.border, width,
        animation: 'ep-pulse 1.5s ease-in-out infinite' }} />
    )
  }

  // ── HK Attention Item ─────────────────────────────────────────────────────
  function AttentionItem({ task }: { task: HKAttentionTask }) {
    const cfg  = TYPE_CFG[task.hk_escalation_type] ?? TYPE_CFG.none
    const days = parseInt(task.days_waiting, 10)
    const isOld = days >= 3
    return (
      <div style={{ padding: isMobile ? '16px 14px' : '18px 22px', borderBottom: `1px solid ${T.border}`,
        display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Priority dot */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', marginTop: 6, flexShrink: 0,
          background: task.priority === 'high' ? T.red : cfg.color,
          boxShadow: task.priority === 'high' ? `0 0 8px ${T.red}88` : 'none' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tags row */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: cfg.color,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em' }}>
              {cfg.tag}
            </span>
            <span style={{ fontSize: 10, color: T.text3, fontWeight: 600 }}>{task.company}</span>
            {isOld && (
              <span style={{ fontSize: 9, color: T.amber, background: `${T.amber}12`,
                border: `1px solid ${T.amber}33`, borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>
                {days}d waiting
              </span>
            )}
          </div>
          {/* Title */}
          <div style={{ fontSize: 14, fontWeight: 700, color: T.text, marginBottom: 5, lineHeight: 1.35 }}>
            {task.particulars}
          </div>
          {/* Latest update */}
          {task.latest_update && (
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 5, lineHeight: 1.4,
              overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
              {task.latest_update}
            </div>
          )}
          {/* Note from escalator */}
          {task.hk_escalation_note && (
            <div style={{ fontSize: 11, color: T.text2, background: `${T.greenDim}10`,
              border: `1px solid ${T.border2}`, borderRadius: 6, padding: '5px 9px', marginBottom: 5 }}>
              <span style={{ color: T.text3 }}>Note:</span> {task.hk_escalation_note}
              {task.hk_escalation_by && <span style={{ color: T.text3 }}> — {task.hk_escalation_by}</span>}
            </div>
          )}
          {/* Meta */}
          <div style={{ fontSize: 10, color: T.text3 }}>
            {task.section} · Owner: <span style={{ color: T.text2, fontWeight: 600 }}>{task.responsible}</span>
          </div>
        </div>
        {/* Action button */}
        <a href={`/tasks/board?id=${task.id}`}
          style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}`,
            borderRadius: 8, padding: '7px 16px', textDecoration: 'none', display: 'block',
            transition: 'opacity 0.15s' }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
          {cfg.action} →
        </a>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg,
      fontFamily: 'system-ui,-apple-system,sans-serif', color: T.text }}>

      <style>{`@keyframes ep-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.7} }`}</style>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ background: '#060e09', borderBottom: `1px solid ${T.border}`,
        padding: isMobile ? '0 14px' : '0 28px',
        display: 'flex', alignItems: 'center', height: 50,
        gap: isMobile ? 8 : 20, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 14, color: T.gold, letterSpacing: '0.15em' }}>PABARI</span>
          {!isMobile && (
            <span style={{ fontSize: 9, color: T.text3, letterSpacing: '0.08em', fontWeight: 700,
              background: `${T.greenDim}22`, border: `1px solid ${T.greenDim}44`,
              borderRadius: 4, padding: '2px 6px' }}>INTELLIGENCE</span>
          )}
        </div>
        <div style={{ flex: 1 }} />

        {/* Desktop nav */}
        {!isMobile && (isHK
          ? [['Tasks', '/tasks/board'], ['Connect', '/connect'], ['Centre', '/centre']]
          : [['Tasks', '/tasks/board'], ['Connect', '/connect'], ['Documents', '/documents'], ['Finance', '/finance'], ['Projects', '/projects'], ['Centre', '/centre']]
        ).map(([l, h]) => (
          <a key={l} href={h} style={{ color: T.text3, fontSize: 12, textDecoration: 'none',
            fontWeight: 600, letterSpacing: '0.04em' }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.text3)}>{l}</a>
        ))}
        {!isMobile && (
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(181,131,58,0.15)', border: '1px solid rgba(181,131,58,0.35)',
            borderRadius: 6, padding: '5px 12px', color: '#b5833a',
            fontSize: 12, fontWeight: 700, textDecoration: 'none' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(181,131,58,0.25)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(181,131,58,0.15)' }}>
            ← Workspace
          </a>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setNavOpen(n => !n)}
              style={{ background: 'none', border: `1px solid ${T.border}`, borderRadius: 6,
                color: T.text2, fontSize: 16, padding: '4px 10px', cursor: 'pointer' }}>☰</button>
            {navOpen && (
              <>
                <div onClick={() => setNavOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 98 }} />
                <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 99,
                  background: '#0e1a12', border: `1px solid ${T.border}`,
                  borderRadius: 10, minWidth: 160, overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.6)' }}>
                  {[['Tasks', '/tasks/board'], ['Connect', '/connect'], ['Centre', '/centre']].map(([l, h]) => (
                    <a key={l} href={h} onClick={() => setNavOpen(false)}
                      style={{ display: 'block', padding: '11px 16px', fontSize: 13,
                        fontWeight: 600, color: T.text2, textDecoration: 'none',
                        borderBottom: `1px solid ${T.border}` }}>{l}</a>
                  ))}
                  <a href="/" onClick={() => setNavOpen(false)}
                    style={{ display: 'block', padding: '11px 16px', fontSize: 13,
                      fontWeight: 700, color: '#b5833a', textDecoration: 'none' }}>← Workspace</a>
                </div>
              </>
            )}
          </div>
        )}

        <NotificationBell userEmail={currentUser.email} />

        {/* User menu */}
        <div style={{ position: 'relative' }}>
          <div onClick={() => setUserMenu(m => !m)}
            style={{ width: 30, height: 30, borderRadius: '50%',
              background: `${T.greenDim}33`, border: `1px solid ${T.greenDim}55`,
              color: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, cursor: 'pointer', userSelect: 'none' }}>
            {initials}
          </div>
          {userMenu && (
            <>
              <div onClick={() => setUserMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <div style={{ position: 'absolute', top: 38, right: 0, zIndex: 100,
                background: '#0e1a12', border: `1px solid ${T.border}`,
                borderRadius: 10, minWidth: 180, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{currentUser.name}</div>
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>{currentUser.email}</div>
                </div>
                <button onClick={() => { setUserMenu(false); setPwForm({ current: '', next: '', confirm: '' }); setPwError(''); setPwSuccess(false); setShowPwModal(true) }}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '10px 14px', fontSize: 12, color: T.text2, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${T.border}44`)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  🔑 Change Password
                </button>
                <button onClick={signOut}
                  style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none',
                    padding: '10px 14px', fontSize: 12, color: '#f87171', cursor: 'pointer',
                    borderTop: `1px solid ${T.border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  → Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </nav>

      {/* ── Change Password Modal ──────────────────────────────────────── */}
      {showPwModal && (
        <div onClick={e => e.target === e.currentTarget && setShowPwModal(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#0e1a12', border: `1px solid ${T.border}`,
            borderRadius: 16, width: '100%', maxWidth: 400, padding: 28 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 20 }}>Change Password</div>
            {pwSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                <div style={{ color: T.green, fontSize: 13, fontWeight: 600 }}>Password updated successfully</div>
                <button onClick={() => setShowPwModal(false)}
                  style={{ marginTop: 20, background: T.green, border: 'none', borderRadius: 8,
                    padding: '10px 24px', fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>Done</button>
              </div>
            ) : (
              <>
                {[{ label: 'Current Password', key: 'current' }, { label: 'New Password', key: 'next' }, { label: 'Confirm New', key: 'confirm' }].map(f => (
                  <div key={f.key} style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: T.text3,
                      textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 5 }}>{f.label}</label>
                    <input type="password" value={(pwForm as Record<string, string>)[f.key]}
                      onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box', background: T.card,
                        border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 12px',
                        fontSize: 13, color: T.text, outline: 'none' }} />
                  </div>
                ))}
                {pwError && <div style={{ fontSize: 12, color: '#f87171', background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
                  padding: '8px 12px', marginBottom: 14 }}>{pwError}</div>}
                <div style={{ fontSize: 10, color: T.text3, marginBottom: 16, lineHeight: 1.6 }}>
                  Min 8 chars · uppercase · number · special character
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowPwModal(false)}
                    style={{ flex: 1, background: T.card, border: `1px solid ${T.border}`,
                      borderRadius: 8, padding: 11, fontSize: 13, fontWeight: 600,
                      color: T.text3, cursor: 'pointer' }}>Cancel</button>
                  <button disabled={pwSaving}
                    onClick={async () => {
                      if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match'); return }
                      setPwSaving(true); setPwError('')
                      const res = await fetch('/api/auth/change-password', {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
                      })
                      const d = await res.json()
                      setPwSaving(false)
                      if (!res.ok) { setPwError(d.error ?? 'Error'); return }
                      setPwSuccess(true)
                    }}
                    style={{ flex: 2, background: T.greenDim, border: 'none', borderRadius: 8,
                      padding: 11, fontSize: 13, fontWeight: 700, color: 'white',
                      cursor: pwSaving ? 'wait' : 'pointer', opacity: pwSaving ? 0.7 : 1 }}>
                    {pwSaving ? 'Saving…' : 'Update Password'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(180deg, #0a1a10 0%, #060c08 100%)',
        borderBottom: `1px solid ${T.border}`,
        padding: isMobile ? '28px 16px 24px' : '44px 32px 36px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: T.text3,
            letterSpacing: '0.14em', marginBottom: 14, textTransform: 'uppercase' }}>
            Executive Briefing · Pabari Group
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 28 : 42, fontWeight: 900,
            color: T.text, lineHeight: 1.05, letterSpacing: '-0.5px' }}>
            {getGreeting()}, {firstName}.
          </h1>
          <p style={{ margin: '6px 0 0', color: T.text3, fontSize: 12, fontWeight: 500 }}>{fmtDate()}</p>

          {/* Briefing summary */}
          <div style={{ marginTop: 20, maxWidth: 620 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton width="90%" height={14} />
                <Skeleton width="70%" height={14} />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 15, color: T.text2, lineHeight: 1.6, fontWeight: 400 }}>
                {briefing}
              </p>
            )}
          </div>

          {/* CTA row */}
          <div style={{ marginTop: 24, display: 'flex', alignItems: 'center',
            gap: 14, flexWrap: 'wrap' }}>
            <a href="/centre"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                background: T.greenDim, color: 'white', padding: '11px 22px',
                borderRadius: 10, textDecoration: 'none', fontWeight: 700,
                fontSize: 13, border: `1px solid ${T.green}`,
                boxShadow: `0 0 20px ${T.green}25`, letterSpacing: '0.01em' }}>
              View My Briefing →
            </a>
            {!loading && totalItems > 0 && (
              <span style={{ fontSize: 12, color: T.text3,
                background: `${T.border}88`, border: `1px solid ${T.border}`,
                borderRadius: 20, padding: '6px 14px', fontWeight: 500 }}>
                {totalItems} executive item{totalItems !== 1 ? 's' : ''} · ≈{reviewMins} min
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1100, margin: '0 auto',
        padding: isMobile ? '20px 14px 60px' : '28px 28px 60px' }}>

        {/* ── THREE METRIC CARDS ──────────────────────────────────────────── */}
        <div style={{ display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: 14, marginBottom: 24 }}>
          {[
            {
              label: 'NEEDS YOUR DECISION',
              value: loading ? '…' : needsDecision,
              sub: 'Items requiring a decision or approval',
              color: needsDecision > 0 ? T.red : T.green,
              href: '/tasks/board',
            },
            {
              label: 'AWAITING YOUR INPUT',
              value: loading ? '…' : awaitingInput,
              sub: 'Items where your comment or direction is needed',
              color: awaitingInput > 0 ? T.amber : T.green,
              href: '/tasks/board',
            },
            {
              label: 'FOR AWARENESS',
              value: loading ? '…' : forAwareness,
              sub: 'Important developments for your awareness',
              color: forAwareness > 0 ? T.blue : T.text2,
              href: '/tasks/board',
            },
          ].map(m => (
            <a key={m.label} href={m.href} style={{ textDecoration: 'none' }}>
              <div style={{ ...card, padding: isMobile ? '20px 18px' : '26px 24px',
                transition: 'border-color 0.15s', cursor: 'pointer' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = T.border2)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = T.border)}>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.text3,
                  letterSpacing: '0.12em', marginBottom: 14 }}>{m.label}</div>
                <div style={{ fontSize: isMobile ? 40 : 52, fontWeight: 900, color: m.color,
                  lineHeight: 1, marginBottom: 10 }}>{m.value}</div>
                <div style={{ fontSize: 11, color: T.text3, lineHeight: 1.4 }}>{m.sub}</div>
              </div>
            </a>
          ))}
        </div>

        {/* ── NEEDS YOUR ATTENTION ────────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ padding: isMobile ? '16px 14px' : '18px 22px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.text,
                letterSpacing: '0.06em', textTransform: 'uppercase' }}>Needs Your Attention</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>
                {loading ? 'Loading…'
                  : hkAttention.length === 0 ? 'No items currently require your attention'
                  : `${Math.min(hkAttention.length, 5)} of ${hkAttention.length} escalated item${hkAttention.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            <a href="/tasks/board"
              style={{ fontSize: 11, color: T.green, fontWeight: 700, textDecoration: 'none',
                background: `${T.greenDim}18`, border: `1px solid ${T.greenDim}33`,
                borderRadius: 6, padding: '5px 12px', whiteSpace: 'nowrap' }}>
              View all →
            </a>
          </div>

          {loading ? (
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Skeleton width="30%" height={10} />
                  <Skeleton width="75%" height={14} />
                  <Skeleton width="55%" height={10} />
                </div>
              ))}
            </div>
          ) : hkAttention.length === 0 ? (
            <div style={{ padding: '48px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.5 }}>◈</div>
              <div style={{ color: T.green, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>You're all caught up</div>
              <div style={{ color: T.text3, fontSize: 12 }}>No matters currently require your attention.</div>
            </div>
          ) : (
            hkAttention.slice(0, 5).map(task => <AttentionItem key={task.id} task={task} />)
          )}
        </div>

        {/* ── YOUR WEEK ───────────────────────────────────────────────────── */}
        <div style={{ ...card, marginBottom: 20 }}>
          <div style={{ padding: isMobile ? '16px 14px' : '18px 22px',
            borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.text,
              letterSpacing: '0.06em', textTransform: 'uppercase' }}>Your Week</div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>
              Org-wide summary — last 7 days · ORG ACTIVE is total tasks across all companies, not your personal queue
            </div>
          </div>

          {/* Four metrics */}
          <div style={{ display: 'grid',
            gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)',
            borderBottom: `1px solid ${T.border}` }}>
            {[
              { label: 'COMPLETED',        value: data?.resolvedThisWeek  ?? 0, color: T.green },
              { label: 'ESCALATED TO YOU', value: data?.escalatedThisWeek ?? 0, color: T.amber },
              { label: 'ORG ACTIVE',       value: data?.pendingCount       ?? 0, color: T.text2 },
              { label: 'LONG-RUNNING',     value: data?.longRunningCount   ?? 0, color: (data?.longRunningCount ?? 0) > 2 ? T.red : T.text3 },
            ].map((m, i) => (
              <div key={m.label} style={{ padding: isMobile ? '18px 14px' : '22px 22px',
                borderRight: (!isMobile && i < 3) ? `1px solid ${T.border}` : 'none',
                borderBottom: (isMobile && i < 2) ? `1px solid ${T.border}` : 'none' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.text3,
                  letterSpacing: '0.1em', marginBottom: 10 }}>{m.label}</div>
                <div style={{ fontSize: isMobile ? 32 : 40, fontWeight: 900, color: m.color, lineHeight: 1 }}>
                  {loading ? '…' : m.value}
                </div>
              </div>
            ))}
          </div>

          {/* AI review */}
          <div style={{ padding: isMobile ? '18px 14px' : '22px 22px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Skeleton width="85%" height={13} />
                <Skeleton width="65%" height={13} />
              </div>
            ) : (
              <>
                <div style={{ fontSize: 9, fontWeight: 800, color: T.text3,
                  letterSpacing: '0.1em', marginBottom: 8 }}>AI WEEKLY REVIEW</div>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: T.text2, lineHeight: 1.6 }}>
                  {weekReview.summary}
                </p>
                <div style={{ background: `${T.greenDim}10`, border: `1px solid ${T.greenDim}28`,
                  borderRadius: 8, padding: '12px 16px', marginBottom: 18 }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: T.green,
                    letterSpacing: '0.1em', marginBottom: 6 }}>AI RECOMMENDATION</div>
                  <p style={{ margin: 0, fontSize: 12, color: T.text2, lineHeight: 1.55 }}>
                    {weekReview.recommendation}
                  </p>
                </div>
                <a href="/centre"
                  style={{ fontSize: 12, color: T.green, fontWeight: 700, textDecoration: 'none',
                    background: `${T.greenDim}14`, border: `1px solid ${T.greenDim}33`,
                    borderRadius: 7, padding: '8px 16px', display: 'inline-block' }}>
                  Read Full Review →
                </a>
              </>
            )}
          </div>
        </div>

        {/* ── TEAM PULSE + RECENT ACTIVITY ────────────────────────────────── */}
        <div style={{ display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 16, marginBottom: 20 }}>

          {/* Team Pulse */}
          <div style={card}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.text,
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team Pulse</div>
                <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>Operational health overview</div>
              </div>
              <a href="/intelligence"
                style={{ fontSize: 10, color: T.text3, textDecoration: 'none', fontWeight: 600,
                  background: T.card2, border: `1px solid ${T.border}`, borderRadius: 5, padding: '3px 10px' }}>
                View Team →
              </a>
            </div>
            <div style={{ padding: '8px 0' }}>
              {loading ? (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[1, 2, 3].map(i => <Skeleton key={i} width="70%" height={11} />)}
                </div>
              ) : health.map(h => (
                <div key={h.name}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: h.color,
                      boxShadow: `0 0 6px ${h.color}66`, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: T.text }}>{h.name}</div>
                      <div style={{ fontSize: 9, color: T.text3, marginTop: 1 }}>{h.detail}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 800, color: h.color,
                    background: `${h.color}15`, border: `1px solid ${h.color}30`,
                    borderRadius: 5, padding: '3px 9px' }}>{h.label}</span>
                </div>
              ))}
              {data && (
                <div style={{ padding: '12px 20px', display: 'flex', gap: 20 }}>
                  <div style={{ fontSize: 10, color: T.text3 }}>
                    Completed this week: <span style={{ color: T.green, fontWeight: 700 }}>{data.resolvedThisWeek}</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.text3 }}>
                    At risk: <span style={{ color: data.longRunningCount > 0 ? T.red : T.text2, fontWeight: 700 }}>{data.longRunningCount}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div style={card}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${T.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.text,
                  textTransform: 'uppercase', letterSpacing: '0.06em' }}>Recent Activity</div>
                <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>Latest organisational updates</div>
              </div>
              <a href="/audit"
                style={{ fontSize: 10, color: T.text3, textDecoration: 'none', fontWeight: 600,
                  background: T.card2, border: `1px solid ${T.border}`, borderRadius: 5, padding: '3px 10px' }}>
                View Activity →
              </a>
            </div>
            <div style={{ padding: '6px 0' }}>
              {loading ? (
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} style={{ display: 'flex', gap: 10 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.border, flexShrink: 0 }} />
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 2 }}>
                        <Skeleton width="75%" height={10} />
                        <Skeleton width="40%" height={9} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : recentActivity.length === 0 ? (
                <div style={{ padding: '24px 20px', color: T.text3, fontSize: 12 }}>No recent activity.</div>
              ) : recentActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 20px',
                  borderBottom: i < recentActivity.length - 1 ? `1px solid ${T.border}` : 'none',
                  alignItems: 'flex-start' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%',
                    background: T.card2, border: `1px solid ${T.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, fontWeight: 800, color: T.text2, flexShrink: 0 }}>
                    {a.user_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: T.text, lineHeight: 1.4 }}>
                      <span style={{ fontWeight: 700 }}>{a.user_name}</span>{' '}
                      <span style={{ color: T.text3 }}>{ACTION_LABELS[a.action] ?? a.action}</span>
                    </div>
                    {a.details && (
                      <div style={{ fontSize: 10, color: T.text3, marginTop: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.details}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: T.text3, flexShrink: 0, marginTop: 1 }}>
                    {fmtRelative(a.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ASK PABARI INTELLIGENCE ─────────────────────────────────────── */}
        <div style={card}>
          <div style={{ padding: isMobile ? '16px 14px' : '18px 22px',
            borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: T.green,
              letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Ask Pabari Intelligence
            </div>
            <div style={{ fontSize: 10, color: T.text3, marginTop: 3 }}>
              Ask anything about your organisation — powered by live data
            </div>
          </div>

          {/* Chat history */}
          {chatHistory.length > 0 && (
            <div style={{ padding: isMobile ? '12px 14px' : '14px 22px',
              borderBottom: `1px solid ${T.border}`,
              display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 340, overflowY: 'auto' }}>
              {chatHistory.map((h, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 6 }}>
                    <div style={{ background: `${T.greenDim}20`, border: `1px solid ${T.greenDim}30`,
                      borderRadius: '10px 10px 3px 10px', padding: '8px 12px',
                      fontSize: 12, color: T.text, maxWidth: '80%', lineHeight: 1.4 }}>
                      {h.q}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ width: 22, height: 22, borderRadius: '50%',
                      background: `${T.greenDim}22`, border: `1px solid ${T.greenDim}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, color: T.green, flexShrink: 0, marginTop: 2 }}>⚡</div>
                    <div style={{ background: T.card2, border: `1px solid ${T.border2}`,
                      borderRadius: '3px 10px 10px 10px', padding: '8px 12px',
                      fontSize: 12, color: T.text2, maxWidth: '85%', lineHeight: 1.55, flex: 1 }}>
                      {h.a}
                    </div>
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%',
                    background: `${T.greenDim}22`, border: `1px solid ${T.greenDim}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: T.green, flexShrink: 0, marginTop: 2 }}>⚡</div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '12px' }}>
                    {[0, 1, 2].map(j => (
                      <div key={j} style={{ width: 6, height: 6, borderRadius: '50%',
                        background: T.green, opacity: 0.6,
                        animation: `ep-pulse 1s ease-in-out ${j * 0.2}s infinite` }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Suggested questions */}
          {chatHistory.length === 0 && (
            <div style={{ padding: isMobile ? '14px 14px 0' : '16px 22px 0',
              display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button key={q} onClick={() => askAI(q)}
                  style={{ fontSize: 11, color: T.text2, background: T.card2,
                    border: `1px solid ${T.border2}`, borderRadius: 20,
                    padding: '6px 14px', cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = `${T.greenDim}18`; e.currentTarget.style.borderColor = `${T.greenDim}44`; e.currentTarget.style.color = T.green }}
                  onMouseLeave={e => { e.currentTarget.style.background = T.card2; e.currentTarget.style.borderColor = T.border2; e.currentTarget.style.color = T.text2 }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: isMobile ? '14px 14px' : '16px 22px',
            display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(chatInput) } }}
              placeholder="Ask anything about your organisation…"
              style={{ flex: 1, background: T.card2, border: `1px solid ${T.border2}`,
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: T.text,
                outline: 'none', fontFamily: 'inherit' }}
              onFocus={e => (e.currentTarget.style.borderColor = `${T.greenDim}55`)}
              onBlur={e => (e.currentTarget.style.borderColor = T.border2)}
            />
            <button
              onClick={() => askAI(chatInput)}
              disabled={chatLoading || !chatInput.trim()}
              style={{ background: chatLoading || !chatInput.trim() ? T.card2 : T.greenDim,
                border: `1px solid ${chatLoading || !chatInput.trim() ? T.border : T.green}`,
                borderRadius: 8, padding: '10px 18px', fontSize: 12, fontWeight: 700,
                color: chatLoading || !chatInput.trim() ? T.text3 : 'white',
                cursor: chatLoading || !chatInput.trim() ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
              {chatLoading ? '…' : 'Ask →'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
