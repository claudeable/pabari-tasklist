'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import NotificationBell from './NotificationBell'

interface ActionTask { id: string; particulars: string; company: string; responsible: string; priority: string }
interface PcrItem    { req_no: string; employee_name: string; company: string; total_amount: string; status: string }
interface Activity   { user_name: string; action: string; details: string; created_at: string }
interface PerfRow    { responsible: string; resolved: string; open: string }
interface CompanyRow { company: string; total: string; action_req: string }

interface ExecData {
  today: string
  totalOpen: number; actionRequired: number; needsHkComment: number
  awaitingApproval: number; resolvedToday: number
  pcrActive: number; pcrHighValue: number; leavePending: number; docCount: number
  actionTasks: ActionTask[]; approvalTasks: ActionTask[]
  pcrItems: PcrItem[]; todayActivity: Activity[]
  weeklyPerf: PerfRow[]; byCompany: CompanyRow[]
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

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function fmtAmt(v: string | number) {
  return `KES ${Number(v).toLocaleString()}`
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

export default function ExecutivePortal({ currentUser }: { currentUser: SessionUser }) {
  const [data, setData] = useState<ExecData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandPCR, setExpandPCR] = useState(false)
  const [expandCompany, setExpandCompany] = useState(false)

  const firstName = currentUser.name.split(' ')[0]
  const initials = currentUser.name.split(/\s+/).map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()

  useEffect(() => {
    fetch('/api/executive-portal', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  // ── Health status ──────────────────────────────────────────────────────
  function taskHealth() {
    if (!data) return { color: '#6b7280', label: 'Loading', dot: '#9ca3af' }
    if (data.actionRequired > 5)  return { color: '#dc2626', label: 'Critical', dot: '#dc2626' }
    if (data.actionRequired > 0)  return { color: '#f59e0b', label: 'Needs Attention', dot: '#f59e0b' }
    return { color: '#16a34a', label: 'On Track', dot: '#16a34a' }
  }
  function formsHealth() {
    if (!data) return { color: '#6b7280', label: 'Loading', dot: '#9ca3af' }
    if (data.pcrHighValue > 0 || data.leavePending > 2) return { color: '#f59e0b', label: 'Pending', dot: '#f59e0b' }
    if (data.pcrActive === 0 && data.leavePending === 0) return { color: '#16a34a', label: 'All Clear', dot: '#16a34a' }
    return { color: '#16a34a', label: 'Normal', dot: '#16a34a' }
  }

  const th = taskHealth()
  const fh = formsHealth()

  const card: React.CSSProperties = {
    background: 'white', borderRadius: 12,
    border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ background: '#111827', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52, gap: 24 }}>
        <span style={{ fontWeight: 900, fontSize: 16, color: 'white', letterSpacing: '0.08em' }}>PABARI</span>
        <div style={{ flex: 1 }} />
        {[['Tasks', '/tasks'], ['Portal', '/'], ['Forms', '/forms'], ['Documents', '/documents'], ['Centre', '/centre']].map(([l, h]) => (
          <a key={l} href={h} style={{ color: '#9ca3af', fontSize: 13, textDecoration: 'none', fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'white')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}>{l}</a>
        ))}
        <NotificationBell userEmail={currentUser.email} />
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#1a3a2a', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          onClick={signOut} title="Sign out">{initials}</div>
      </nav>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #1a3a2a 0%, #0f2318 100%)', padding: '36px 32px 28px', color: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: '#86efac', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 6 }}>
                EXECUTIVE PORTAL · PABARI GROUP
              </div>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'white' }}>
                {getGreeting()}, {firstName}.
              </h1>
              <p style={{ margin: '6px 0 0', color: '#6ee7b7', fontSize: 14 }}>{fmtDate()}</p>
            </div>
            <a href="/centre"
              style={{ background: '#16a34a', color: 'white', padding: '10px 20px', borderRadius: 10, textDecoration: 'none', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚡ Executive AI
            </a>
          </div>

          {/* ── Health strip ── */}
          <div style={{ display: 'flex', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            {[
              { label: 'Tasks', ...th },
              { label: 'Forms', ...fh },
              { label: 'Documents', color: '#16a34a', dot: '#16a34a', label2: 'Live' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot, boxShadow: `0 0 6px ${s.dot}` }} />
                <span style={{ fontSize: 13, color: '#e5e7eb', fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: s.color, fontWeight: 700 }}>{(s as {label2?: string}).label2 ?? (s as {label?: string}).label ?? ''}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN ────────────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 48px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24 }}>

        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Metric row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Action Required', value: data?.actionRequired ?? '—', color: '#dc2626', bg: '#fef2f2', href: '/tasks' },
              { label: 'Need HK Comment', value: data?.needsHkComment ?? '—', color: '#f59e0b', bg: '#fffbeb', href: '/tasks' },
              { label: 'Resolved Today',  value: data?.resolvedToday  ?? '—', color: '#16a34a', bg: '#f0fdf4', href: '/tasks' },
              { label: 'Total Open',      value: data?.totalOpen      ?? '—', color: '#1d4ed8', bg: '#eff6ff', href: '/tasks' },
            ].map(m => (
              <a key={m.label} href={m.href} style={{ ...card, padding: '16px 18px', textDecoration: 'none', display: 'block', background: m.bg, border: `1px solid ${m.color}22` }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: m.color }}>{loading ? '…' : m.value}</div>
                <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginTop: 4 }}>{m.label}</div>
              </a>
            ))}
          </div>

          {/* ── Priority Queue ── */}
          <div style={card}>
            <div style={{ padding: '18px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                ⚡ Priority Queue
              </div>
              <a href="/centre" style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, textDecoration: 'none' }}>Open AI Review →</a>
            </div>

            <div style={{ padding: '12px 0' }}>
              {loading ? (
                <div style={{ padding: '20px 20px', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
              ) : (
                <>
                  {/* Action Required tasks */}
                  {data?.actionTasks.map((t, i) => (
                    <a key={t.id} href="/tasks" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderTop: i === 0 ? '1px solid #f3f4f6' : '1px solid #f9fafb', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.priority === 'critical' ? '#dc2626' : '#f59e0b', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' }}>Action Required</span>
                          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{t.company}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#111827', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.particulars}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Owner: {t.responsible} · {t.priority} priority</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>→</span>
                    </a>
                  ))}

                  {/* HK Comment queue */}
                  {(data?.needsHkComment ?? 0) > 0 && (
                    <a href="/tasks" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderTop: '1px solid #f3f4f6', textDecoration: 'none', background: '#fffbeb' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fef3c7')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fffbeb')}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: '#b45309', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase', marginRight: 8 }}>Pending Comment</span>
                        <span style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{data?.needsHkComment} tasks need your HK comment</span>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Review and add your comment to unblock the team</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>→</span>
                    </a>
                  )}

                  {/* Awaiting approval */}
                  {data?.approvalTasks.map((t, i) => (
                    <a key={t.id} href="/tasks" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderTop: '1px solid #f9fafb', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' }}>Awaiting Your Approval</span>
                          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{t.company}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#111827', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.particulars}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Owner: {t.responsible}</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>→</span>
                    </a>
                  ))}

                  {/* PCR high value */}
                  {data?.pcrItems.filter(r => Number(r.total_amount) >= 100000).map((r, i) => (
                    <a key={r.req_no} href="/forms/petty-cash" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderTop: '1px solid #f9fafb', textDecoration: 'none' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: Number(r.total_amount) >= 500000 ? '#dc2626' : '#f59e0b', marginTop: 5, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 4, padding: '1px 6px', textTransform: 'uppercase' }}>
                            {Number(r.total_amount) >= 500000 ? 'High Value PCR' : 'PCR'}
                          </span>
                          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{r.company}</span>
                        </div>
                        <div style={{ fontSize: 13, color: '#111827', fontWeight: 600 }}>{r.req_no} — {r.employee_name} · {fmtAmt(r.total_amount)}</div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Status: {r.status}</div>
                      </div>
                      <span style={{ fontSize: 12, color: '#9ca3af', flexShrink: 0 }}>→</span>
                    </a>
                  ))}

                  {!loading && (data?.actionTasks.length ?? 0) === 0 && (data?.needsHkComment ?? 0) === 0 && (data?.approvalTasks.length ?? 0) === 0 && (data?.pcrHighValue ?? 0) === 0 && (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#16a34a', fontSize: 13, fontWeight: 600 }}>
                      ✅ All clear — no urgent items
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Company Breakdown ── */}
          <div style={card}>
            <button onClick={() => setExpandCompany(p => !p)}
              style={{ width: '100%', background: 'none', border: 'none', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tasks by Company</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{expandCompany ? '▲ collapse' : '▼ expand'}</span>
            </button>
            {expandCompany && (
              <div style={{ padding: '0 0 12px' }}>
                {(data?.byCompany ?? []).map((c, i) => {
                  const ar = parseInt(c.action_req, 10)
                  const total = parseInt(c.total, 10)
                  return (
                    <div key={c.company} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderTop: '1px solid #f3f4f6' }}>
                      <div style={{ width: 120, fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company}</div>
                      <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: ar > 0 ? '#f59e0b' : '#1a3a2a', width: `${Math.min(100, total * 2)}%`, borderRadius: 4 }} />
                      </div>
                      <div style={{ fontSize: 12, color: '#374151', fontWeight: 600, width: 60, textAlign: 'right' }}>{c.total} open</div>
                      {ar > 0 && <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 700, width: 80 }}>{ar} action req</div>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Weekly Team Performance ── */}
          <div style={card}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Weekly Team Performance</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Tasks resolved this week per person</div>
            </div>
            <div style={{ padding: '8px 0 8px' }}>
              {loading ? <div style={{ padding: '16px 20px', color: '#9ca3af', fontSize: 13 }}>Loading…</div> :
                (data?.weeklyPerf ?? []).length === 0
                  ? <div style={{ padding: '16px 20px', color: '#6b7280', fontSize: 13 }}>No resolved tasks this week yet.</div>
                  : (data?.weeklyPerf ?? []).map(p => {
                    const resolved = parseInt(p.resolved, 10)
                    const open = parseInt(p.open, 10)
                    return (
                      <div key={p.responsible} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderBottom: '1px solid #f9fafb' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: resolved > 0 ? '#1a3a2a' : '#f3f4f6', color: resolved > 0 ? 'white' : '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                          {p.responsible.split(' ')[0][0]}{p.responsible.split(' ')[1]?.[0] ?? ''}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.responsible}</div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{open} open tasks</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: resolved > 0 ? '#16a34a' : '#9ca3af' }}>{resolved}</div>
                          <div style={{ fontSize: 10, color: '#6b7280' }}>resolved</div>
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Quick Actions ── */}
          <div style={card}>
            <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Quick Access</div>
            </div>
            <div style={{ padding: '12px' }}>
              {[
                { icon: '⚡', label: 'Executive AI', sub: 'Briefing & search', href: '/centre', highlight: true },
                { icon: '✓', label: 'Task Management', sub: `${data?.totalOpen ?? '—'} open tasks`, href: '/tasks' },
                { icon: '📋', label: 'Forms', sub: `${(data?.pcrActive ?? 0) + (data?.leavePending ?? 0)} pending`, href: '/forms' },
                { icon: '📁', label: 'Documents', sub: `${data?.docCount ?? '—'} files`, href: '/documents' },
                { icon: '💳', label: 'Finance', sub: 'LPO · Delivery Notes', href: '/finance' },
                { icon: '📐', label: 'Projects', sub: 'Milestones · Gantt', href: '/projects' },
              ].map(s => (
                <a key={s.label} href={s.href}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 8, textDecoration: 'none', marginBottom: 4, background: s.highlight ? '#1a3a2a' : 'transparent' }}
                  onMouseEnter={e => (e.currentTarget.style.background = s.highlight ? '#0f2318' : '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = s.highlight ? '#1a3a2a' : 'transparent')}>
                  <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>{s.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: s.highlight ? 'white' : '#111827' }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: s.highlight ? '#86efac' : '#6b7280' }}>{s.sub}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* ── PCR Summary ── */}
          {(data?.pcrActive ?? 0) > 0 && (
            <div style={card}>
              <button onClick={() => setExpandPCR(p => !p)}
                style={{ width: '100%', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Petty Cash</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>{data?.pcrActive} active · {data?.pcrHighValue} high-value</div>
                </div>
                <span style={{ fontSize: 12, color: '#6b7280' }}>{expandPCR ? '▲' : '▼'}</span>
              </button>
              {expandPCR && (
                <div style={{ padding: '0 0 8px' }}>
                  {(data?.pcrItems ?? []).map(r => {
                    const amt = Number(r.total_amount)
                    return (
                      <a key={r.req_no} href="/forms/petty-cash"
                        style={{ display: 'block', padding: '8px 16px', borderTop: '1px solid #f3f4f6', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{r.req_no} — {r.employee_name}</div>
                            <div style={{ fontSize: 11, color: '#6b7280' }}>{r.company} · {r.status}</div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: amt >= 500000 ? '#dc2626' : amt >= 100000 ? '#f59e0b' : '#374151' }}>
                            {fmtAmt(r.total_amount)}
                          </div>
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Today's Activity Timeline ── */}
          <div style={card}>
            <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Today's Activity</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Live team activity feed</div>
            </div>
            <div style={{ padding: '8px 0', maxHeight: 380, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: '16px', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
              ) : (data?.todayActivity ?? []).length === 0 ? (
                <div style={{ padding: '16px', color: '#6b7280', fontSize: 13 }}>No activity yet today.</div>
              ) : (
                (data?.todayActivity ?? []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 16px', borderBottom: '1px solid #f9fafb' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#374151', flexShrink: 0 }}>
                      {a.user_name.split(' ').map((w: string) => w[0]).slice(0, 2).join('')}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>
                        {a.user_name} <span style={{ fontWeight: 400, color: '#6b7280' }}>{ACTION_LABELS[a.action] ?? a.action}</span>
                      </div>
                      {a.details && <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.details}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtTime(a.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
