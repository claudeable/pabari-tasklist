'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import NotificationBell from './NotificationBell'

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

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtDay(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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

async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.href = '/login'
}

function riskLevel(actionRequired: number, avgWait: number) {
  if (actionRequired > 10 || avgWait > 7) return { label: 'Critical', color: '#dc2626' }
  if (actionRequired > 4  || avgWait > 3) return { label: 'Medium',   color: '#f59e0b' }
  return { label: 'Low', color: '#16a34a' }
}

function companyHealth(total: number, actionReq: number) {
  if (total === 0) return 100
  return Math.round(((total - actionReq) / total) * 100)
}

export default function ExecutivePortal({ currentUser }: { currentUser: SessionUser }) {
  const [data, setData] = useState<ExecData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activityTab, setActivityTab] = useState<'all' | 'today'>('all')

  const firstName = currentUser.name.split(' ')[0]
  const initials  = currentUser.name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    fetch('/api/executive-portal', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  const decisions     = (data?.actionRequired ?? 0) + (data?.awaitingApproval ?? 0)
  const estReviewMins = Math.round(decisions * 1.5)
  const risk          = riskLevel(data?.actionRequired ?? 0, data?.avgWaitDays ?? 0)

  // AI Recommendations — top items from action queue
  const recommendations: { text: string; tag: string; href: string; color: string }[] = []
  if (data) {
    const topAction = data.actionTasks.slice(0, 2)
    topAction.forEach(t => recommendations.push({
      text: `Review: ${t.particulars.length > 45 ? t.particulars.slice(0, 45) + '…' : t.particulars}`,
      tag: t.priority === 'critical' ? 'Critical' : 'High impact',
      href: '/tasks',
      color: t.priority === 'critical' ? '#dc2626' : '#f59e0b',
    }))
    if (data.awaitingApproval > 0) recommendations.push({
      text: `Approve ${data.awaitingApproval} pending task${data.awaitingApproval > 1 ? 's' : ''} awaiting your sign-off`,
      tag: `${data.awaitingApproval} items`,
      href: '/tasks',
      color: '#1d4ed8',
    })
    if (data.pcrHighValue > 0) recommendations.push({
      text: `Review ${data.pcrHighValue} high-value petty cash request${data.pcrHighValue > 1 ? 's' : ''}`,
      tag: 'Finance',
      href: '/forms',
      color: '#059669',
    })
  }

  // Workload — most loaded person
  const mostLoaded = data?.workload[0]

  // Activity filtered
  const todayStr = new Date().toISOString().slice(0, 10)
  const filteredActivity = activityTab === 'today'
    ? (data?.activityFeed ?? []).filter(a => a.created_at.slice(0, 10) === todayStr)
    : (data?.activityFeed ?? [])

  const card: React.CSSProperties = {
    background: 'white', borderRadius: 12,
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ background: '#0c1a12', padding: '0 28px', display: 'flex', alignItems: 'center', height: 50, gap: 24 }}>
        <span style={{ fontWeight: 900, fontSize: 15, color: 'white', letterSpacing: '0.1em' }}>PABARI</span>
        <div style={{ flex: 1 }} />
        {[['Tasks','/tasks'],['Portal','/'],['Forms','/forms'],['Documents','/documents'],['Finance','/finance'],['Projects','/projects'],['Centre','/centre']].map(([l, h]) => (
          <a key={l} href={h} style={{ color: '#6b7280', fontSize: 12, textDecoration: 'none', fontWeight: 600, letterSpacing: '0.04em' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}>{l}</a>
        ))}
        <NotificationBell userEmail={currentUser.email} />
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: '#1a3a2a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
          onClick={signOut} title="Sign out">{initials}</div>
      </nav>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #0f2318 0%, #1a3a2a 60%, #0c2515 100%)', padding: '32px 32px 24px', color: 'white' }}>
        <div style={{ maxWidth: 1240, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 8 }}>
                EXECUTIVE PORTAL · PABARI GROUP
              </div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: 'white', lineHeight: 1.1 }}>
                {getGreeting()}, {firstName}.
              </h1>
              <p style={{ margin: '10px 0 0', color: '#86efac', fontSize: 14 }}>{fmtDate()}</p>
              {!loading && (
                <p style={{ margin: '8px 0 0', color: '#d1fae5', fontSize: 15, fontWeight: 500 }}>
                  You have{' '}
                  <span style={{ color: 'white', fontWeight: 800 }}>{decisions} executive decision{decisions !== 1 ? 's' : ''}</span>
                  {' '}today.
                  {decisions > 0 && (
                    <span style={{ color: '#86efac', fontSize: 13, marginLeft: 8 }}>
                      Estimated review time: {estReviewMins} min
                    </span>
                  )}
                </p>
              )}
            </div>
            <a href="/centre"
              style={{ background: '#16a34a', color: 'white', padding: '12px 22px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, border: '1px solid #22c55e', boxShadow: '0 0 20px rgba(34,197,94,0.3)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>Pabari Intelligence</span>
              <span style={{ fontSize: 10, color: '#bbf7d0', fontWeight: 500 }}>Your briefing is ready →</span>
            </a>
          </div>

          {/* ── Health chips ── */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Tasks', color: risk.color, dot: risk.color, status: risk.label },
              { label: 'Forms', color: (data?.pcrHighValue ?? 0) > 0 || (data?.leavePending ?? 0) > 2 ? '#f59e0b' : '#16a34a', dot: (data?.pcrHighValue ?? 0) > 0 ? '#f59e0b' : '#16a34a', status: (data?.pcrHighValue ?? 0) > 0 ? 'Needs Review' : 'All Clear' },
              { label: 'Documents', color: '#16a34a', dot: '#16a34a', status: 'Live' },
              { label: 'Finance', color: '#16a34a', dot: '#16a34a', status: 'Live' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot, boxShadow: `0 0 6px ${s.dot}88` }} />
                <span style={{ fontSize: 12, color: '#d1fae5', fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI RECOMMENDATIONS STRIP ────────────────────────────────────── */}
      {!loading && recommendations.length > 0 && (
        <div style={{ background: '#0f172a', borderBottom: '1px solid #1e293b', padding: '12px 32px' }}>
          <div style={{ maxWidth: 1240, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#4ade80', letterSpacing: '0.1em', flexShrink: 0 }}>PABARI INTELLIGENCE</span>
            {recommendations.map((r, i) => (
              <a key={i} href={r.href}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: `1px solid ${r.color}44`, borderRadius: 20, padding: '5px 12px', textDecoration: 'none', flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: r.color, fontWeight: 800 }}>✔</span>
                <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 500 }}>{r.text}</span>
                <span style={{ fontSize: 10, color: r.color, background: `${r.color}22`, borderRadius: 4, padding: '1px 6px', fontWeight: 700 }}>{r.tag}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* ── KPI STRIP ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1240, margin: '20px auto 0', padding: '0 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
          {[
            { label: 'Pending Decisions',  value: loading ? '…' : decisions,                     sub: `${data?.actionRequired ?? 0} action req · ${data?.awaitingApproval ?? 0} approval`, color: decisions > 0 ? '#dc2626' : '#16a34a' },
            { label: 'Avg Wait Time',      value: loading ? '…' : `${data?.avgWaitDays ?? 0}d`,  sub: `Oldest: ${data?.oldestDays ?? 0} days`,  color: (data?.avgWaitDays ?? 0) > 5 ? '#dc2626' : (data?.avgWaitDays ?? 0) > 2 ? '#f59e0b' : '#374151' },
            { label: 'Business Risk',      value: loading ? '…' : risk.label,                    sub: `${data?.actionRequired ?? 0} critical items`, color: risk.color },
            { label: 'Backlog',            value: loading ? '…' : data?.totalOpen ?? '—',        sub: 'open tasks',  color: '#1d4ed8' },
            { label: 'Resolved Today',     value: loading ? '…' : data?.resolvedToday ?? '—',   sub: 'completed',   color: '#16a34a' },
          ].map(m => (
            <div key={m.label} style={{ ...card, padding: '14px 16px' }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 11, color: '#111827', fontWeight: 700, marginTop: 4 }}>{m.label}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{m.sub}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN GRID ───────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1240, margin: '0 auto', padding: '16px 24px 48px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

        {/* ── LEFT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── Executive Decisions ── */}
          <div style={card}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Executive Decisions
                </div>
                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                  {loading ? 'Loading…' : `${decisions} items requiring your attention`}
                </div>
              </div>
              <a href="/centre" style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textDecoration: 'none', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px' }}>
                ⚡ AI Review →
              </a>
            </div>

            <div>
              {loading ? (
                <div style={{ padding: '24px', color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>Loading decisions…</div>
              ) : (
                <>
                  {/* Action Required */}
                  {data?.actionTasks.map((t) => {
                    const days = parseInt(t.days_waiting, 10)
                    const isOld = days >= 5
                    return (
                      <a key={t.id} href={`/tasks?id=${t.id}`}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f9fafb', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.priority === 'critical' ? '#dc2626' : '#f59e0b', marginTop: 4, flexShrink: 0, boxShadow: t.priority === 'critical' ? '0 0 6px #dc262688' : 'none' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Action Required</span>
                            <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{t.company}</span>
                            {isOld && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, background: '#fef2f2', borderRadius: 4, padding: '1px 6px' }}>⚠ {days}d waiting</span>}
                          </div>
                          <div style={{ fontSize: 13, color: '#111827', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.particulars}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                            Owner: <span style={{ fontWeight: 600, color: '#374151' }}>{t.responsible}</span>
                            {!isOld && days > 0 && <span style={{ marginLeft: 8, color: '#9ca3af' }}>· Waiting {days} day{days !== 1 ? 's' : ''}</span>}
                            <span style={{ marginLeft: 8, color: t.priority === 'critical' ? '#dc2626' : '#f59e0b', fontWeight: 700, textTransform: 'capitalize' }}>· {t.priority}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0, fontWeight: 600 }}>Review →</span>
                      </a>
                    )
                  })}

                  {/* Awaiting Approval */}
                  {data?.approvalTasks.map((t) => {
                    const days = parseInt(t.days_waiting, 10)
                    return (
                      <a key={t.id} href={`/tasks?id=${t.id}`}
                        style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f9fafb', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3b82f6', marginTop: 4, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 10, fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Awaiting Approval</span>
                            <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{t.company}</span>
                            {days >= 5 && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 700, background: '#fef2f2', borderRadius: 4, padding: '1px 6px' }}>⚠ {days}d waiting</span>}
                          </div>
                          <div style={{ fontSize: 13, color: '#111827', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.particulars}</div>
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
                            Owner: <span style={{ fontWeight: 600, color: '#374151' }}>{t.responsible}</span>
                            {days > 0 && <span style={{ marginLeft: 8, color: '#9ca3af' }}>· Waiting {days} day{days !== 1 ? 's' : ''}</span>}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0, fontWeight: 600 }}>Review →</span>
                      </a>
                    )
                  })}

                  {/* HK comment queue */}
                  {(data?.needsHkComment ?? 0) > 0 && (
                    <a href="/tasks?filter=hk_comment"
                      style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f9fafb', textDecoration: 'none', background: '#fffbeb' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fef9c3')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fffbeb')}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 7px', textTransform: 'uppercase' }}>HK Comment Queue</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#111827', fontWeight: 700 }}>
                          {data?.needsHkComment} tasks need your HK comment
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                          Your comment unlocks the next step for the team
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0, fontWeight: 600 }}>Review →</span>
                    </a>
                  )}

                  {/* PCR high value */}
                  {data?.pcrItems.filter(r => Number(r.total_amount) >= 100000).map((r) => (
                    <a key={r.req_no} href="/forms"
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 20px', borderBottom: '1px solid #f9fafb', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#059669', marginTop: 4, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 4, padding: '1px 7px', textTransform: 'uppercase' }}>
                            {Number(r.total_amount) >= 500000 ? 'High Value PCR' : 'PCR Approval'}
                          </span>
                          <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 600 }}>{r.company}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#111827', fontWeight: 700 }}>{r.req_no} — {r.employee_name}</div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{fmtAmt(r.total_amount)} · {r.status}</div>
                      </div>
                      <span style={{ fontSize: 11, color: '#d1d5db', flexShrink: 0, fontWeight: 600 }}>Review →</span>
                    </a>
                  ))}

                  {!loading && decisions === 0 && (data?.needsHkComment ?? 0) === 0 && (data?.pcrHighValue ?? 0) === 0 && (
                    <div style={{ padding: '28px', textAlign: 'center' }}>
                      <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
                      <div style={{ color: '#16a34a', fontSize: 14, fontWeight: 700 }}>All clear — no pending decisions</div>
                      <div style={{ color: '#9ca3af', fontSize: 12, marginTop: 4 }}>Great work. Check back later.</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Team Workload Intelligence ── */}
          <div style={card}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Team Workload</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Open task distribution across team</div>
            </div>
            <div style={{ padding: '8px 0 8px' }}>
              {loading ? (
                <div style={{ padding: '16px 20px', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
              ) : (data?.workload ?? []).length === 0 ? (
                <div style={{ padding: '16px 20px', color: '#6b7280', fontSize: 13 }}>No workload data.</div>
              ) : (() => {
                const maxOpen = Math.max(...(data?.workload ?? []).map(p => parseInt(p.open, 10)), 1)
                return (data?.workload ?? []).map(p => {
                  const open = parseInt(p.open, 10)
                  const resolved = parseInt(p.resolved_week, 10)
                  const overloaded = open > 25
                  const pct = Math.round((open / maxOpen) * 100)
                  return (
                    <div key={p.responsible} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px', borderBottom: '1px solid #f9fafb' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', background: overloaded ? '#fee2e2' : '#f0fdf4', color: overloaded ? '#dc2626' : '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                        {p.responsible.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.responsible}</span>
                          {overloaded && <span style={{ fontSize: 9, color: '#dc2626', background: '#fee2e2', borderRadius: 4, padding: '1px 5px', fontWeight: 800, flexShrink: 0 }}>OVERLOADED</span>}
                        </div>
                        <div style={{ background: '#f3f4f6', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: overloaded ? '#dc2626' : '#1a3a2a', width: `${pct}%`, borderRadius: 3, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: overloaded ? '#dc2626' : '#111827' }}>{open}</div>
                        <div style={{ fontSize: 9, color: '#9ca3af' }}>{resolved > 0 ? `+${resolved} this wk` : 'open'}</div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>

        {/* ── RIGHT ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── AI Insights ── */}
          <div style={{ ...card, background: '#0f172a', border: '1px solid #1e293b' }}>
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #1e293b' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pabari Intelligence</div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Computed from live system data</div>
            </div>
            <div style={{ padding: '12px 0' }}>
              {[
                { label: "Today's Risks",      value: loading ? '…' : String(data?.actionRequired ?? 0), unit: 'action required',  color: (data?.actionRequired ?? 0) > 5 ? '#f87171' : '#4ade80' },
                { label: 'Most Overloaded',    value: loading ? '…' : (mostLoaded?.responsible.split(' ')[0] ?? '—'), unit: mostLoaded ? `${mostLoaded.open} open tasks` : '', color: '#fb923c' },
                { label: 'Oldest Pending',     value: loading ? '…' : `${data?.oldestDays ?? 0}d`,  unit: 'without resolution', color: (data?.oldestDays ?? 0) > 14 ? '#f87171' : '#94a3b8' },
                { label: 'HK Comment Queue',   value: loading ? '…' : String(data?.needsHkComment ?? 0), unit: 'tasks blocked', color: '#fbbf24' },
                { label: 'Suggested Actions',  value: loading ? '…' : String(recommendations.length), unit: 'from AI above', color: '#4ade80' },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 18px', borderBottom: '1px solid #1e293b' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: '#475569' }}>{s.unit}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.value}</div>
                </div>
              ))}
              <div style={{ padding: '12px 18px' }}>
                <a href="/centre" style={{ display: 'block', background: '#16a34a', color: 'white', borderRadius: 8, padding: '9px', textAlign: 'center', textDecoration: 'none', fontSize: 12, fontWeight: 700 }}>
                  Open Pabari Intelligence →
                </a>
              </div>
            </div>
          </div>

          {/* ── Business Health ── */}
          <div style={card}>
            <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Business Health</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>By company — % tasks on track</div>
            </div>
            <div style={{ padding: '8px 0 4px' }}>
              {loading ? (
                <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
              ) : (data?.byCompany ?? []).map(c => {
                const health = companyHealth(parseInt(c.total, 10), parseInt(c.action_req, 10))
                const healthColor = health >= 90 ? '#16a34a' : health >= 70 ? '#f59e0b' : '#dc2626'
                const indicator   = health >= 90 ? '🟢' : health >= 70 ? '🟠' : '🔴'
                return (
                  <div key={c.company} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', borderBottom: '1px solid #f9fafb' }}>
                    <span style={{ fontSize: 12 }}>{indicator}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: healthColor }}>{health}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Activity Feed ── */}
          <div style={card}>
            <div style={{ padding: '14px 16px 0', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activity</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['all', 'today'] as const).map(t => (
                    <button key={t} onClick={() => setActivityTab(t)}
                      style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: 'none', cursor: 'pointer', fontWeight: 700, background: activityTab === t ? '#111827' : '#f3f4f6', color: activityTab === t ? 'white' : '#6b7280' }}>
                      {t === 'all' ? 'All History' : 'Today'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '14px 16px', color: '#9ca3af', fontSize: 12 }}>Loading…</div>
              ) : filteredActivity.length === 0 ? (
                <div style={{ padding: '14px 16px', color: '#6b7280', fontSize: 12 }}>No activity{activityTab === 'today' ? ' yet today' : ''}.</div>
              ) : (() => {
                let lastDay = ''
                return filteredActivity.map((a, i) => {
                  const day = fmtDay(a.created_at)
                  const showDivider = day !== lastDay
                  lastDay = day
                  return (
                    <div key={i}>
                      {showDivider && (
                        <div style={{ padding: '6px 16px 2px', fontSize: 10, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', background: '#f9fafb', borderBottom: '1px solid #f3f4f6' }}>{day}</div>
                      )}
                      <div style={{ display: 'flex', gap: 8, padding: '7px 16px', borderBottom: '1px solid #f9fafb' }}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#374151', flexShrink: 0 }}>
                          {a.user_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: '#111827' }}>
                            {a.user_name} <span style={{ fontWeight: 400, color: '#6b7280' }}>{ACTION_LABELS[a.action] ?? a.action}</span>
                          </div>
                          {a.details && <div style={{ fontSize: 10, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details}</div>}
                        </div>
                        <div style={{ fontSize: 10, color: '#9ca3af', flexShrink: 0 }}>
                          {activityTab === 'all' ? fmtRelative(a.created_at) : fmtTime(a.created_at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
