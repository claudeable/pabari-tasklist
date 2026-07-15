'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import NotificationBell from './NotificationBell'

// ── Design tokens ─────────────────────────────────────────────────────────
const T = {
  bg:      '#060c08',
  card:    '#0b1610',
  card2:   '#0f1c13',
  border:  '#162214',
  border2: '#1e2e1a',
  text:    '#e2ede7',
  text2:   '#7aaa87',
  text3:   '#4a7055',
  green:   '#22c55e',
  greenDim:'#16a34a',
  amber:   '#f59e0b',
  red:     '#ef4444',
  gold:    '#b5833a',
  blue:    '#60a5fa',
}

// ── Types ─────────────────────────────────────────────────────────────────
interface ActionTask {
  id: string; particulars: string; company: string
  responsible: string; priority: string; days_waiting: string
}
interface ApprovalTask {
  id: string; particulars: string; company: string
  responsible: string; days_waiting: string
}
interface PcrItem    { req_no: string; employee_name: string; company: string; total_amount: string; status: string }
interface Activity   { user_name: string; action: string; details: string; created_at: string }
interface WorkloadRow { responsible: string; open: string; resolved_week: string }
interface CompanyRow  { company: string; total: string; action_req: string }

interface ExecData {
  today: string
  totalOpen: number; actionRequired: number; needsHkComment: number
  awaitingApproval: number; resolvedToday: number
  oldestDays: number; avgWaitDays: number
  pcrActive: number; pcrHighValue: number; leavePending: number; docCount: number
  actionTasks: ActionTask[]; approvalTasks: ApprovalTask[]
  pcrItems: PcrItem[]; activityFeed: Activity[]
  workload: WorkloadRow[]; byCompany: CompanyRow[]
}

interface ForecastItem {
  category: string
  observation: string
  impact: string
  recommendation: string
  confidence: number
}

interface Rec {
  title: string
  reason: string
  impact: string
  priority: 'critical' | 'high' | 'medium'
  confidence: number
  href: string
}

// ── Helpers ───────────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function fmtDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtAmt(v: string | number) {
  return `KES ${Number(v).toLocaleString()}`
}

function fmtRelative(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs  = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0)  return `${days}d ago`
  if (hrs  > 0)  return `${hrs}h ago`
  if (mins > 0)  return `${mins}m ago`
  return 'just now'
}

function genRecommendations(data: ExecData): Rec[] {
  const recs: Rec[] = []

  const critical = data.actionTasks.filter(t => t.priority === 'critical')
  if (critical.length > 0) {
    const t = critical[0]
    recs.push({
      title: `Clear ${critical.length} critical item${critical.length > 1 ? 's' : ''}`,
      reason: `"${t.particulars.slice(0, 58)}" (${t.company}) · ${t.days_waiting}d waiting`,
      impact: `${critical.length * 2}+ downstream tasks unblocked`,
      priority: 'critical',
      confidence: 96,
      href: `/tasks?id=${t.id}`,
    })
  }

  if ((data.needsHkComment ?? 0) >= 6) {
    recs.push({
      title: `Comment on ${data.needsHkComment} blocked tasks`,
      reason: `Your direction is the only thing stopping the team from progressing each of these`,
      impact: `${data.needsHkComment} team members unblocked immediately`,
      priority: data.needsHkComment > 20 ? 'critical' : 'high',
      confidence: 99,
      href: '/tasks',
    })
  }

  const sorted = [...data.actionTasks].sort((a, b) => parseInt(b.days_waiting) - parseInt(a.days_waiting))
  const oldest = sorted[0]
  if (oldest && parseInt(oldest.days_waiting) >= 7 && oldest.priority !== 'critical') {
    recs.push({
      title: `Resolve ${oldest.days_waiting}-day pending item`,
      reason: `"${oldest.particulars.slice(0, 55)}" from ${oldest.company} — SLA exposure rising`,
      impact: `Eliminates longest-standing risk in the backlog`,
      priority: 'high',
      confidence: 88,
      href: `/tasks?id=${oldest.id}`,
    })
  }

  if ((data.pcrHighValue ?? 0) > 0) {
    const top = data.pcrItems.find(p => Number(p.total_amount) >= 100000)
    recs.push({
      title: `Approve ${data.pcrHighValue} high-value PCR${data.pcrHighValue > 1 ? 's' : ''}`,
      reason: top
        ? `${top.employee_name} (${top.company}) — ${fmtAmt(top.total_amount)} awaiting sign-off`
        : `Finance requests are holding up operations`,
      impact: `Cash flow maintained, operations unblocked`,
      priority: 'high',
      confidence: 94,
      href: '/forms',
    })
  }

  if ((data.awaitingApproval ?? 0) >= 2) {
    recs.push({
      title: `Process ${data.awaitingApproval} pending approvals`,
      reason: `${data.awaitingApproval} tasks await your sign-off — avg ${data.avgWaitDays}d delay compounds daily`,
      impact: `${data.awaitingApproval} tasks advance to next stage`,
      priority: 'medium',
      confidence: 91,
      href: '/tasks',
    })
  }

  const order: Record<string, number> = { critical: 0, high: 1, medium: 2 }
  return recs.sort((a, b) => order[a.priority] - order[b.priority]).slice(0, 5)
}

function computeHealth(data: ExecData) {
  const totalOpen = data.totalOpen || 1
  const opScore   = Math.round(Math.max(0, ((totalOpen - data.actionRequired) / totalOpen) * 100))
  const finScore  = data.pcrHighValue === 0 ? 88 : data.pcrHighValue > 3 ? 48 : 65
  const compScore = data.leavePending === 0 ? 92 : data.leavePending > 5 ? 52 : 72
  const avgWait   = data.avgWaitDays || 0
  const projScore = avgWait > 7 ? 48 : avgWait > 3 ? 68 : 86
  const overloaded = data.workload.filter(p => parseInt(p.open) > 25).length
  const peopleScore = overloaded === 0 ? 90 : overloaded > 2 ? 52 : 70

  const col = (s: number) => s >= 80 ? T.green  : s >= 60 ? T.amber : T.red
  const lbl = (s: number) => s >= 80 ? 'Healthy' : s >= 60 ? 'At Risk' : 'Critical'
  const bg  = (s: number) => s >= 80 ? 'rgba(34,197,94,0.08)' : s >= 60 ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.08)'

  return [
    { name: 'Operations', score: opScore,    color: col(opScore),    label: lbl(opScore),    bg: bg(opScore),    detail: `${data.actionRequired} tasks need action` },
    { name: 'Finance',    score: finScore,   color: col(finScore),   label: lbl(finScore),   bg: bg(finScore),   detail: `${data.pcrHighValue} PCR approvals pending` },
    { name: 'Compliance', score: compScore,  color: col(compScore),  label: lbl(compScore),  bg: bg(compScore),  detail: `${data.leavePending} leave requests open` },
    { name: 'Projects',   score: projScore,  color: col(projScore),  label: lbl(projScore),  bg: bg(projScore),  detail: `${avgWait}d avg approval delay` },
    { name: 'People',     score: peopleScore,color: col(peopleScore),label: lbl(peopleScore),bg: bg(peopleScore),detail: `${overloaded} team member${overloaded !== 1 ? 's' : ''} overloaded` },
  ]
}

const CATEGORY_COLORS: Record<string, string> = {
  Operations: T.blue,
  Finance:    T.green,
  Compliance: T.amber,
  People:     '#a78bfa',
  Projects:   '#fb923c',
}

async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

const ACTION_LABELS: Record<string, string> = {
  login: 'logged in', logout: 'logged out',
  task_created: 'created a task', task_status_changed: 'updated task status',
  task_update_posted: 'posted task update', task_commented: 'added HK comment',
  leave_submitted: 'submitted leave', pcr_submitted: 'submitted petty cash',
  leave_approved: 'approved leave', leave_rejected: 'rejected leave',
  petty_cash_hos_approved: 'approved PCR (HOS)', petty_cash_hod_approved: 'approved PCR (HOD)',
  petty_cash_finance_approved: 'approved PCR (Finance)', petty_cash_disbursed: 'disbursed cash',
  petty_cash_received: 'confirmed receipt', doc_uploaded: 'uploaded document',
}

// ── Component ─────────────────────────────────────────────────────────────
export default function ExecutivePortal({ currentUser }: { currentUser: SessionUser }) {
  const [data, setData]               = useState<ExecData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [forecasts, setForecasts]     = useState<ForecastItem[]>([])
  const [fLoading, setFLoading]       = useState(true)
  const [fTime, setFTime]             = useState('')
  const [fError, setFError]           = useState(false)
  const [actTab, setActTab]           = useState<'all' | 'today'>('all')

  const firstName = currentUser.name.split(' ')[0]
  const initials  = currentUser.name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    fetch('/api/executive-portal', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  function loadForecast() {
    setFLoading(true)
    setFError(false)
    fetch('/api/executive-portal/forecast', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.forecasts?.length) {
          setForecasts(d.forecasts)
          setFTime(new Date(d.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
        } else {
          setFError(true)
        }
      })
      .catch(() => setFError(true))
      .finally(() => setFLoading(false))
  }
  useEffect(() => { loadForecast() }, [])

  const decisions    = (data?.actionRequired ?? 0) + (data?.awaitingApproval ?? 0)
  const reviewMins   = Math.round(decisions * 1.5)
  const recs         = data ? genRecommendations(data) : []
  const health       = data ? computeHealth(data) : []
  const mostLoaded   = data?.workload[0]
  const overloadedPpl = data?.workload.filter(p => parseInt(p.open) > 25).length ?? 0

  const todayStr = new Date().toISOString().slice(0, 10)
  const filteredActivity = actTab === 'today'
    ? (data?.activityFeed ?? []).filter(a => a.created_at.slice(0, 10) === todayStr)
    : (data?.activityFeed ?? [])

  // ── Shared card style ─────────────────────────────────────────────────
  const card = { background: T.card, borderRadius: 10, border: `1px solid ${T.border}` }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: 'system-ui,-apple-system,sans-serif', color: T.text }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ background: '#060e09', borderBottom: `1px solid ${T.border}`, padding: '0 28px', display: 'flex', alignItems: 'center', height: 50, gap: 24, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 14, color: T.gold, letterSpacing: '0.15em' }}>PABARI</span>
          <span style={{ fontSize: 9, color: T.text3, letterSpacing: '0.08em', fontWeight: 700, background: `${T.greenDim}22`, border: `1px solid ${T.greenDim}44`, borderRadius: 4, padding: '2px 6px' }}>INTELLIGENCE</span>
        </div>
        <div style={{ flex: 1 }} />
        {[['Tasks','/tasks'],['Portal','/'],['Forms','/forms'],['Documents','/documents'],['Finance','/finance'],['Projects','/projects'],['Centre','/centre']].map(([l, h]) => (
          <a key={l} href={h} style={{ color: T.text3, fontSize: 12, textDecoration: 'none', fontWeight: 600, letterSpacing: '0.04em', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.text3)}>{l}</a>
        ))}
        <NotificationBell userEmail={currentUser.email} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: `${T.greenDim}33`, border: `1px solid ${T.greenDim}55`, color: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, cursor: 'pointer', letterSpacing: '0.02em' }}
          onClick={signOut} title="Sign out">{initials}</div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(180deg, #0a1510 0%, ${T.bg} 100%)`, borderBottom: `1px solid ${T.border}`, padding: '36px 32px 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>

            {/* Left: greeting + decision count */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.text3, letterSpacing: '0.12em', marginBottom: 12, textTransform: 'uppercase' }}>
                Executive Operating System · Pabari Group
              </div>
              <h1 style={{ margin: 0, fontSize: 34, fontWeight: 900, color: T.text, lineHeight: 1.1 }}>
                {getGreeting()}, {firstName}.
              </h1>
              <p style={{ margin: '8px 0 0', color: T.text3, fontSize: 13 }}>{fmtDate()}</p>

              {!loading && (
                <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 44, fontWeight: 900, color: decisions > 0 ? T.amber : T.green, lineHeight: 1 }}>{decisions}</span>
                    <span style={{ fontSize: 16, color: T.text2, fontWeight: 500 }}>executive decisions today</span>
                  </div>
                  {decisions > 0 && (
                    <span style={{ fontSize: 12, color: T.text3, background: `${T.border}88`, border: `1px solid ${T.border}`, borderRadius: 20, padding: '4px 12px' }}>
                      ≈ {reviewMins} min to review
                    </span>
                  )}
                </div>
              )}

              {/* Domain health chips */}
              {!loading && health.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                  {health.map(h => (
                    <div key={h.name} style={{ display: 'flex', alignItems: 'center', gap: 6, background: h.bg, border: `1px solid ${h.color}33`, borderRadius: 20, padding: '4px 12px' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: h.color, boxShadow: `0 0 5px ${h.color}88` }} />
                      <span style={{ fontSize: 11, color: T.text2, fontWeight: 600 }}>{h.name}</span>
                      <span style={{ fontSize: 11, color: h.color, fontWeight: 800 }}>{h.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: PI button + quick stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              <a href="/centre" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, background: T.greenDim, color: 'white', padding: '14px 28px', borderRadius: 10, textDecoration: 'none', fontWeight: 800, fontSize: 14, border: `1px solid ${T.green}`, boxShadow: `0 0 24px ${T.green}30`, letterSpacing: '0.02em' }}>
                <span>⚡ Open Pabari Intelligence</span>
                <span style={{ fontSize: 10, color: '#bbf7d0', fontWeight: 500 }}>Your full briefing →</span>
              </a>
              {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, width: '100%' }}>
                  {[
                    { v: data?.actionRequired ?? 0, l: 'Action Required', c: (data?.actionRequired ?? 0) > 5 ? T.red : T.amber },
                    { v: data?.awaitingApproval ?? 0, l: 'Awaiting Approval', c: T.blue },
                    { v: data?.needsHkComment ?? 0, l: 'HK Comment Queue', c: T.amber },
                    { v: data?.resolvedToday ?? 0, l: 'Resolved Today', c: T.green },
                  ].map(s => (
                    <div key={s.l} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
                      <div style={{ fontSize: 9, color: T.text3, marginTop: 3, fontWeight: 600 }}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── AI FORECAST ─────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '24px auto 0', padding: '0 24px' }}>
        <div style={{ ...card, overflow: 'hidden' }}>

          {/* Forecast header */}
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#080f0b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: fLoading ? T.text3 : fError ? T.red : T.green, boxShadow: !fLoading && !fError ? `0 0 8px ${T.green}` : 'none' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: T.green, letterSpacing: '0.1em' }}>INTELLIGENCE FORECAST</span>
              {fTime && !fLoading && (
                <span style={{ fontSize: 10, color: T.text3, marginLeft: 4 }}>Generated {fTime}</span>
              )}
            </div>
            <button onClick={loadForecast} disabled={fLoading}
              style={{ background: 'none', border: `1px solid ${T.border}`, color: T.text3, borderRadius: 6, padding: '4px 12px', fontSize: 10, cursor: fLoading ? 'not-allowed' : 'pointer', fontWeight: 700, letterSpacing: '0.04em' }}>
              {fLoading ? 'Generating…' : '↻ Refresh'}
            </button>
          </div>

          {/* Forecast cards */}
          {fLoading ? (
            <div style={{ padding: '24px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 16 }}>
              {[1,2,3,4,5].map(i => (
                <div key={i} style={{ background: T.card2, borderRadius: 8, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[70, 85, 60, 50].map((w, j) => (
                    <div key={j} style={{ height: 12, borderRadius: 4, background: T.border, width: `${w}%`, animation: 'pi-pulse 1.5s ease-in-out infinite', animationDelay: `${j * 0.1}s` }} />
                  ))}
                </div>
              ))}
              <style>{`@keyframes pi-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.7} }`}</style>
            </div>
          ) : fError ? (
            <div style={{ padding: '24px 20px', color: T.text3, fontSize: 13 }}>
              Intelligence engine unavailable — check API connection and refresh.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', padding: '20px', gap: 12 }}>
              {forecasts.map((f, i) => {
                const catColor = CATEGORY_COLORS[f.category] ?? T.text2
                return (
                  <div key={i} style={{ background: T.card2, border: `1px solid ${T.border2}`, borderRadius: 8, overflow: 'hidden' }}>
                    {/* Category top bar */}
                    <div style={{ height: 2, background: catColor }} />
                    <div style={{ padding: '14px 16px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: catColor, letterSpacing: '0.12em', background: `${catColor}18`, border: `1px solid ${catColor}33`, borderRadius: 4, padding: '3px 8px' }}>
                          {f.category.toUpperCase()}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ height: 4, width: 60, background: T.border, borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${f.confidence}%`, background: f.confidence >= 90 ? T.green : f.confidence >= 75 ? T.amber : T.red, borderRadius: 2 }} />
                          </div>
                          <span style={{ fontSize: 10, color: T.text3, fontWeight: 700 }}>{f.confidence}%</span>
                        </div>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: T.text3, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 3 }}>OBSERVATION</div>
                        <p style={{ margin: 0, fontSize: 12, color: T.text, lineHeight: 1.55, fontWeight: 500 }}>{f.observation}</p>
                      </div>

                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 9, color: T.text3, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 3 }}>IMPACT</div>
                        <p style={{ margin: 0, fontSize: 12, color: T.amber, lineHeight: 1.5 }}>{f.impact}</p>
                      </div>

                      <div style={{ background: `${T.greenDim}12`, border: `1px solid ${T.greenDim}30`, borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ fontSize: 9, color: T.green, fontWeight: 800, letterSpacing: '0.08em', marginBottom: 3 }}>RECOMMENDATION</div>
                        <p style={{ margin: 0, fontSize: 12, color: T.text2, lineHeight: 1.5 }}>{f.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 24px 56px', display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI Recommendations */}
          {recs.length > 0 && !loading && (
            <div style={card}>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: T.green, letterSpacing: '0.08em' }}>AI RECOMMENDATIONS</div>
                  <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>Ranked by business impact</div>
                </div>
              </div>
              <div>
                {recs.map((r, i) => {
                  const pc = r.priority === 'critical' ? T.red : r.priority === 'high' ? T.amber : T.blue
                  return (
                    <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 18px', borderBottom: i < recs.length - 1 ? `1px solid ${T.border}` : 'none', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: pc, width: 16, flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{r.title}</span>
                          <span style={{ fontSize: 9, color: pc, background: `${pc}18`, border: `1px solid ${pc}33`, borderRadius: 4, padding: '2px 6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>{r.priority}</span>
                        </div>
                        <div style={{ fontSize: 11, color: T.text3, marginBottom: 4, lineHeight: 1.4 }}>{r.reason}</div>
                        <div style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>↑ {r.impact}</div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <a href={r.href} style={{ fontSize: 11, color: 'white', background: pc, borderRadius: 6, padding: '5px 12px', textDecoration: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          Review →
                        </a>
                        <span style={{ fontSize: 9, color: T.text3 }}>{r.confidence}% confidence</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Executive Decisions */}
          <div style={card}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.text, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Executive Decisions</div>
                <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>
                  {loading ? 'Loading…' : `${decisions} items require your attention`}
                </div>
              </div>
              <a href="/tasks" style={{ fontSize: 11, color: T.green, fontWeight: 700, textDecoration: 'none', background: `${T.greenDim}18`, border: `1px solid ${T.greenDim}33`, borderRadius: 6, padding: '5px 12px' }}>
                View All →
              </a>
            </div>

            {loading ? (
              <div style={{ padding: 24, color: T.text3, fontSize: 13, textAlign: 'center' }}>Loading decisions…</div>
            ) : (
              <>
                {/* Action-required tasks */}
                {data?.actionTasks.map(t => {
                  const days = parseInt(t.days_waiting, 10)
                  const isOld = days >= 5
                  const pColor = t.priority === 'critical' ? T.red : t.priority === 'high' ? T.amber : T.text3
                  return (
                    <div key={t.id} style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: pColor, marginTop: 5, flexShrink: 0, boxShadow: t.priority === 'critical' ? `0 0 8px ${T.red}88` : 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: T.red, background: `${T.red}18`, border: `1px solid ${T.red}33`, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action Required</span>
                          <span style={{ fontSize: 10, color: T.text3 }}>{t.company}</span>
                          {isOld && <span style={{ fontSize: 9, color: T.red, background: `${T.red}12`, borderRadius: 4, padding: '2px 6px', fontWeight: 800 }}>⚠ {days}d waiting</span>}
                          <span style={{ fontSize: 9, color: pColor, fontWeight: 800, textTransform: 'capitalize', marginLeft: 'auto' }}>{t.priority}</span>
                        </div>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{t.particulars}</div>
                        <div style={{ fontSize: 10, color: T.text3 }}>
                          Owner: <span style={{ color: T.text2, fontWeight: 600 }}>{t.responsible}</span>
                          {!isOld && days > 0 && <span style={{ marginLeft: 8 }}>· {days}d waiting</span>}
                        </div>
                      </div>
                      <a href={`/tasks?id=${t.id}`} style={{ fontSize: 11, color: T.text3, textDecoration: 'none', fontWeight: 700, flexShrink: 0, background: T.card2, border: `1px solid ${T.border}`, borderRadius: 6, padding: '5px 12px', whiteSpace: 'nowrap' }}
                        onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.border2 }}
                        onMouseLeave={e => { e.currentTarget.style.color = T.text3; e.currentTarget.style.borderColor = T.border }}>
                        Review →
                      </a>
                    </div>
                  )
                })}

                {/* Awaiting approval tasks */}
                {data?.approvalTasks.map(t => {
                  const days = parseInt(t.days_waiting, 10)
                  return (
                    <div key={t.id} style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.blue, marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 9, fontWeight: 800, color: T.blue, background: `${T.blue}18`, border: `1px solid ${T.blue}33`, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Awaiting Approval</span>
                          <span style={{ fontSize: 10, color: T.text3 }}>{t.company}</span>
                          {days >= 5 && <span style={{ fontSize: 9, color: T.amber, background: `${T.amber}12`, borderRadius: 4, padding: '2px 6px', fontWeight: 800 }}>⚠ {days}d waiting</span>}
                        </div>
                        <div style={{ fontSize: 13, color: T.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{t.particulars}</div>
                        <div style={{ fontSize: 10, color: T.text3 }}>
                          Owner: <span style={{ color: T.text2, fontWeight: 600 }}>{t.responsible}</span>
                          {days > 0 && <span style={{ marginLeft: 8 }}>· {days}d waiting</span>}
                        </div>
                      </div>
                      <a href={`/tasks?id=${t.id}`} style={{ fontSize: 11, color: T.blue, textDecoration: 'none', fontWeight: 700, flexShrink: 0, background: `${T.blue}18`, border: `1px solid ${T.blue}33`, borderRadius: 6, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                        Approve →
                      </a>
                    </div>
                  )
                })}

                {/* HK comment queue */}
                {(data?.needsHkComment ?? 0) > 0 && (
                  <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 14, alignItems: 'flex-start', background: `${T.amber}08` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.amber, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${T.amber}66` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: T.amber, background: `${T.amber}18`, border: `1px solid ${T.amber}33`, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>HK Comment Queue</span>
                      </div>
                      <div style={{ fontSize: 13, color: T.text, fontWeight: 700, marginBottom: 3 }}>
                        {data?.needsHkComment} tasks waiting for your direction
                      </div>
                      <div style={{ fontSize: 10, color: T.text3 }}>Your comment unlocks the next step for each team member</div>
                    </div>
                    <a href="/tasks" style={{ fontSize: 11, color: T.amber, textDecoration: 'none', fontWeight: 700, flexShrink: 0, background: `${T.amber}18`, border: `1px solid ${T.amber}33`, borderRadius: 6, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                      Review →
                    </a>
                  </div>
                )}

                {/* High-value PCRs */}
                {data?.pcrItems.filter(r => Number(r.total_amount) >= 100000).map(r => (
                  <div key={r.req_no} style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, marginTop: 5, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: T.green, background: `${T.green}18`, border: `1px solid ${T.green}33`, borderRadius: 4, padding: '2px 6px', textTransform: 'uppercase' }}>
                          {Number(r.total_amount) >= 500000 ? 'High Value PCR' : 'PCR Approval'}
                        </span>
                        <span style={{ fontSize: 10, color: T.text3 }}>{r.company}</span>
                      </div>
                      <div style={{ fontSize: 13, color: T.text, fontWeight: 700, marginBottom: 3 }}>{r.req_no} — {r.employee_name}</div>
                      <div style={{ fontSize: 10, color: T.text3 }}>{fmtAmt(r.total_amount)} · {r.status}</div>
                    </div>
                    <a href="/forms" style={{ fontSize: 11, color: T.green, textDecoration: 'none', fontWeight: 700, flexShrink: 0, background: `${T.green}18`, border: `1px solid ${T.green}33`, borderRadius: 6, padding: '5px 12px', whiteSpace: 'nowrap' }}>
                      Review →
                    </a>
                  </div>
                ))}

                {!loading && decisions === 0 && (data?.needsHkComment ?? 0) === 0 && (data?.pcrHighValue ?? 0) === 0 && (
                  <div style={{ padding: '36px', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.6 }}>◈</div>
                    <div style={{ color: T.green, fontSize: 14, fontWeight: 700 }}>All clear — no pending decisions</div>
                    <div style={{ color: T.text3, fontSize: 12, marginTop: 4 }}>Check back later.</div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Team Workload */}
          <div style={card}>
            <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team Workload</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>
                {overloadedPpl > 0
                  ? `${overloadedPpl} team member${overloadedPpl > 1 ? 's' : ''} overloaded — rebalance recommended`
                  : 'Open task distribution across team'}
              </div>
            </div>
            <div>
              {loading ? (
                <div style={{ padding: '20px 18px', color: T.text3, fontSize: 13 }}>Loading…</div>
              ) : (data?.workload ?? []).length === 0 ? (
                <div style={{ padding: '20px 18px', color: T.text3, fontSize: 13 }}>No workload data.</div>
              ) : (() => {
                const maxOpen = Math.max(...(data?.workload ?? []).map(p => parseInt(p.open, 10)), 1)
                return (data?.workload ?? []).map(p => {
                  const open = parseInt(p.open, 10)
                  const resolved = parseInt(p.resolved_week, 10)
                  const overloaded = open > 25
                  const pct = Math.round((open / maxOpen) * 100)
                  const barColor = overloaded ? T.red : pct > 60 ? T.amber : T.green
                  return (
                    <div key={p.responsible} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: overloaded ? `${T.red}22` : `${T.greenDim}22`, border: `1px solid ${overloaded ? T.red : T.greenDim}44`, color: overloaded ? T.red : T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>
                        {p.responsible.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.responsible}</span>
                          {overloaded && <span style={{ fontSize: 8, color: T.red, background: `${T.red}18`, border: `1px solid ${T.red}33`, borderRadius: 4, padding: '2px 5px', fontWeight: 800, flexShrink: 0, letterSpacing: '0.04em' }}>OVERLOADED</span>}
                        </div>
                        <div style={{ background: T.border, borderRadius: 3, height: 4, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: barColor, width: `${pct}%`, borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: overloaded ? T.red : T.text }}>{open}</div>
                        <div style={{ fontSize: 9, color: T.text3 }}>{resolved > 0 ? `+${resolved} this wk` : 'open'}</div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Activity Feed */}
          <div style={card}>
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activity</div>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['all', 'today'] as const).map(t => (
                  <button key={t} onClick={() => setActTab(t)}
                    style={{ fontSize: 10, padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 700, background: actTab === t ? T.greenDim : T.card2, color: actTab === t ? 'white' : T.text3 }}>
                    {t === 'all' ? 'All' : 'Today'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '16px 18px', color: T.text3, fontSize: 12 }}>Loading…</div>
              ) : filteredActivity.length === 0 ? (
                <div style={{ padding: '16px 18px', color: T.text3, fontSize: 12 }}>No activity{actTab === 'today' ? ' yet today' : ''}.</div>
              ) : filteredActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 18px', borderBottom: `1px solid ${T.border}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: T.card2, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: T.text2, flexShrink: 0 }}>
                    {a.user_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: T.text }}>
                      <span style={{ fontWeight: 700 }}>{a.user_name}</span>{' '}
                      <span style={{ color: T.text3 }}>{ACTION_LABELS[a.action] ?? a.action}</span>
                    </div>
                    {a.details && <div style={{ fontSize: 10, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details}</div>}
                  </div>
                  <div style={{ fontSize: 10, color: T.text3, flexShrink: 0 }}>{fmtRelative(a.created_at)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AI Insights Panel */}
          <div style={{ ...card, background: '#08110c', border: `1px solid ${T.border}` }}>
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.green, letterSpacing: '0.1em' }}>AI INSIGHTS</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>Computed from live data</div>
            </div>
            <div>
              {[
                {
                  label: 'Most Overloaded',
                  value: loading ? '…' : (mostLoaded?.responsible.split(' ')[0] ?? '—'),
                  detail: mostLoaded ? `${mostLoaded.open} open tasks` : 'no data',
                  color: overloadedPpl > 0 ? T.red : T.green,
                  flag: overloadedPpl > 0,
                },
                {
                  label: 'HK Comment Queue',
                  value: loading ? '…' : String(data?.needsHkComment ?? 0),
                  detail: 'tasks blocked on your direction',
                  color: (data?.needsHkComment ?? 0) > 15 ? T.red : (data?.needsHkComment ?? 0) > 5 ? T.amber : T.green,
                  flag: (data?.needsHkComment ?? 0) > 15,
                },
                {
                  label: 'Oldest Pending',
                  value: loading ? '…' : `${data?.oldestDays ?? 0}d`,
                  detail: 'without resolution',
                  color: (data?.oldestDays ?? 0) > 14 ? T.red : (data?.oldestDays ?? 0) > 7 ? T.amber : T.green,
                  flag: (data?.oldestDays ?? 0) > 14,
                },
                {
                  label: 'Avg Approval Delay',
                  value: loading ? '…' : `${data?.avgWaitDays ?? 0}d`,
                  detail: 'from creation to sign-off',
                  color: (data?.avgWaitDays ?? 0) > 5 ? T.red : (data?.avgWaitDays ?? 0) > 2 ? T.amber : T.green,
                  flag: (data?.avgWaitDays ?? 0) > 5,
                },
                {
                  label: 'Total Backlog',
                  value: loading ? '…' : String(data?.totalOpen ?? 0),
                  detail: 'open tasks across all teams',
                  color: (data?.totalOpen ?? 0) > 200 ? T.amber : T.text2,
                  flag: false,
                },
                {
                  label: 'Resolved Today',
                  value: loading ? '…' : String(data?.resolvedToday ?? 0),
                  detail: 'tasks completed',
                  color: (data?.resolvedToday ?? 0) > 5 ? T.green : T.text3,
                  flag: false,
                },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${T.border}` }}>
                  <div>
                    <div style={{ fontSize: 11, color: T.text2, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {s.flag && <span style={{ width: 4, height: 4, borderRadius: '50%', background: s.color, display: 'inline-block', boxShadow: `0 0 4px ${s.color}` }} />}
                      {s.label}
                    </div>
                    <div style={{ fontSize: 9, color: T.text3, marginTop: 1 }}>{s.detail}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
              <div style={{ padding: '14px 16px' }}>
                <a href="/centre" style={{ display: 'block', background: T.greenDim, color: 'white', borderRadius: 8, padding: '10px', textAlign: 'center', textDecoration: 'none', fontSize: 12, fontWeight: 800, letterSpacing: '0.02em' }}>
                  Open Pabari Intelligence →
                </a>
              </div>
            </div>
          </div>

          {/* Business Health — by domain */}
          <div style={card}>
            <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: T.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Business Health</div>
              <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>By domain · AI-assessed</div>
            </div>
            <div>
              {loading ? (
                <div style={{ padding: '16px', color: T.text3, fontSize: 12 }}>Loading…</div>
              ) : health.map(h => (
                <div key={h.name} style={{ padding: '11px 16px', borderBottom: `1px solid ${T.border}`, background: h.bg }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: h.color, boxShadow: `0 0 5px ${h.color}88` }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.text }}>{h.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 10, color: h.color, fontWeight: 800, background: `${h.color}18`, border: `1px solid ${h.color}33`, borderRadius: 4, padding: '2px 8px' }}>{h.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 900, color: h.color, minWidth: 36, textAlign: 'right' }}>{h.score}%</span>
                    </div>
                  </div>
                  <div style={{ background: T.border, borderRadius: 2, height: 3, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{ height: '100%', background: h.color, width: `${h.score}%`, borderRadius: 2, transition: 'width 0.8s ease', boxShadow: `0 0 6px ${h.color}66` }} />
                  </div>
                  <div style={{ fontSize: 9, color: T.text3 }}>{h.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Business Health — by company */}
          {(data?.byCompany ?? []).length > 0 && (
            <div style={card}>
              <div style={{ padding: '14px 16px 12px', borderBottom: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Company Health</div>
                <div style={{ fontSize: 10, color: T.text3, marginTop: 2 }}>Tasks on track per company</div>
              </div>
              <div>
                {(data?.byCompany ?? []).map(c => {
                  const total = parseInt(c.total, 10)
                  const actReq = parseInt(c.action_req, 10)
                  const score = total === 0 ? 100 : Math.round(((total - actReq) / total) * 100)
                  const col = score >= 85 ? T.green : score >= 65 ? T.amber : T.red
                  return (
                    <div key={c.company} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: `1px solid ${T.border}` }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, flexShrink: 0, boxShadow: `0 0 4px ${col}66` }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                        <div style={{ fontSize: 9, color: T.text3, marginTop: 1 }}>{total} tasks · {actReq} pending</div>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 900, color: col }}>{score}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
