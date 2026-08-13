'use client'

import { useMemo } from 'react'

/* ── types ─────────────────────────────────────────────────── */
export interface DashboardTask {
  id: string
  particulars: string
  company: string
  section: string
  category: string
  priority: string
  status: string
  due_date: string
  updated_at: string
  latestUpdate: string
}

export interface DashboardCounts {
  active: number
  dueToday: number
  dueThisWeek: number
  waiting: number
  overdue: number
  completedThisWeek: number
}

interface Props {
  user: { name: string; email: string; role: string }
  counts: DashboardCounts
  attentionTasks: DashboardTask[]
  upcomingTasks: DashboardTask[]
  waitingTasks: DashboardTask[]
  completedTasks: DashboardTask[]
  canCreateTask: boolean
  todayStr: string
}

/* ── static maps ────────────────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = {
  'pending-discussion':    'Pending Discussion',
  'action-required':       'Action Required',
  'in-review':             'In Review',
  'awaiting-hod-approval': 'Awaiting HOD Approval',
  'awaiting-hk-approval':  'Awaiting HK Approval',
  'resolved':              'Completed',
  'expired':               'Expired',
  'archived':              'Archived',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'pending-discussion':    { bg: '#f1f5f9', color: '#475569' },
  'action-required':       { bg: '#fef2f2', color: '#b91c1c' },
  'in-review':             { bg: '#eff6ff', color: '#1d4ed8' },
  'awaiting-hod-approval': { bg: '#fffbeb', color: '#b45309' },
  'awaiting-hk-approval':  { bg: '#fffbeb', color: '#b45309' },
  'resolved':              { bg: '#f0fdf4', color: '#15803d' },
  'expired':               { bg: '#f9fafb', color: '#6b7280' },
  'archived':              { bg: '#f9fafb', color: '#6b7280' },
}

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  low:      { bg: '#f9fafb', color: '#6b7280' },
  medium:   { bg: '#fffbeb', color: '#b45309' },
  high:     { bg: '#fef2f2', color: '#b91c1c' },
  critical: { bg: '#fdf4ff', color: '#7e22ce' },
}

/* ── helpers ────────────────────────────────────────────────── */
function formatDueLabel(due_date: string, today: string): string {
  if (!due_date) return '—'
  if (due_date === today) return 'Today'
  const d = new Date(today)
  d.setDate(d.getDate() + 1)
  const tomorrow = d.toISOString().slice(0, 10)
  if (due_date === tomorrow) return 'Tomorrow'
  const parsed = new Date(due_date)
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function isOverdue(due_date: string, today: string): boolean {
  return !!due_date && due_date < today
}

function taskUrl(id: string): string {
  return `/tasks?id=${id}`
}

/* ── sub-components ─────────────────────────────────────────── */
function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      background: bg,
      color,
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.02em',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

function StatCard({
  label,
  value,
  accentBg,
  accentColor,
  icon,
}: {
  label: string
  value: number
  accentBg: string
  accentColor: string
  icon: string
}) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      flex: '1 1 130px',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        fontSize: 30,
        fontWeight: 700,
        color: accentColor,
        lineHeight: 1,
      }}>{value}</span>
      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{label}</span>
    </div>
  )
}

function AttentionCard({ task, today }: { task: DashboardTask; today: string }) {
  const overdue = isOverdue(task.due_date, today)
  const sc = STATUS_COLORS[task.status] ?? { bg: '#f9fafb', color: '#374151' }
  const pc = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS.medium

  return (
    <a href={taskUrl(task.id)} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: '#fff',
        border: `1px solid ${overdue ? '#fca5a5' : '#e5e7eb'}`,
        borderLeft: `4px solid ${overdue ? '#ef4444' : task.status === 'action-required' ? '#b91c1c' : '#1a3a2a'}`,
        borderRadius: '0 8px 8px 0',
        padding: '14px 18px',
        marginBottom: 8,
        cursor: 'pointer',
        transition: 'box-shadow 0.15s',
      }}
        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4, lineHeight: 1.4 }}>
              {task.particulars}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
              {task.company}{task.section ? ` · ${task.section}` : ''}
            </div>
            {task.latestUpdate && (
              <div style={{ fontSize: 12, color: '#374151', background: '#f9fafb', borderRadius: 4, padding: '4px 8px', marginBottom: 8 }}>
                {task.latestUpdate}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge label={STATUS_LABELS[task.status] ?? task.status} bg={sc.bg} color={sc.color} />
              <Badge label={task.priority} bg={pc.bg} color={pc.color} />
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {task.due_date && (
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: overdue ? '#dc2626' : task.due_date === today ? '#ea580c' : '#374151',
              }}>
                {overdue ? '⚠ Overdue' : formatDueLabel(task.due_date, today)}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#b5833a', fontWeight: 600, marginTop: 4 }}>
              View →
            </div>
          </div>
        </div>
      </div>
    </a>
  )
}

function UpcomingRow({ task, today }: { task: DashboardTask; today: string }) {
  const sc = STATUS_COLORS[task.status] ?? { bg: '#f9fafb', color: '#374151' }
  return (
    <a href={taskUrl(task.id)} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 6,
          background: '#f0fdf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}>
          📋
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.particulars}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{task.company}</div>
        </div>
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <Badge label={STATUS_LABELS[task.status] ?? task.status} bg={sc.bg} color={sc.color} />
        </div>
      </div>
    </a>
  )
}

function WaitingRow({ task }: { task: DashboardTask }) {
  const sc = STATUS_COLORS[task.status] ?? { bg: '#f9fafb', color: '#374151' }
  return (
    <a href={taskUrl(task.id)} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 6,
          background: '#fffbeb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}>
          ⏳
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.particulars}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{task.company}</div>
        </div>
        <div style={{ flexShrink: 0 }}>
          <Badge label={STATUS_LABELS[task.status] ?? task.status} bg={sc.bg} color={sc.color} />
        </div>
      </div>
    </a>
  )
}

function CompletedRow({ task }: { task: DashboardTask }) {
  const completedDate = task.updated_at ? new Date(task.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ''
  return (
    <a href={taskUrl(task.id)} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid #f3f4f6',
        cursor: 'pointer',
      }}>
        <div style={{
          width: 34,
          height: 34,
          borderRadius: 6,
          background: '#f0fdf4',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          flexShrink: 0,
        }}>
          ✅
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.particulars}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280' }}>{task.company}</div>
        </div>
        {completedDate && (
          <div style={{ fontSize: 11, color: '#15803d', fontWeight: 500, flexShrink: 0 }}>
            {completedDate}
          </div>
        )}
      </div>
    </a>
  )
}

/* ── main component ─────────────────────────────────────────── */
export default function TaskDashboard({
  user,
  counts,
  attentionTasks,
  upcomingTasks,
  waitingTasks,
  completedTasks,
  canCreateTask,
  todayStr,
}: Props) {
  const firstName = user.name.split(' ')[0]

  const dateStr = useMemo(() => {
    const d = new Date(todayStr + 'T12:00:00')
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }, [todayStr])

  // Group upcoming tasks by date label
  const upcomingGrouped = useMemo(() => {
    const groups: { label: string; tasks: DashboardTask[] }[] = []
    const seen = new Map<string, DashboardTask[]>()
    for (const t of upcomingTasks) {
      const label = formatDueLabel(t.due_date, todayStr)
      if (!seen.has(label)) {
        seen.set(label, [])
        groups.push({ label, tasks: seen.get(label)! })
      }
      seen.get(label)!.push(t)
    }
    return groups
  }, [upcomingTasks, todayStr])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      fontFamily: '"Inter", "Segoe UI", system-ui, sans-serif',
    }}>
      {/* ── header ── */}
      <header style={{
        background: '#1a3a2a',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              background: '#b5833a',
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.08em',
              padding: '3px 8px',
              borderRadius: 4,
            }}>PABARI</span>
          </a>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>|</span>
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: '0.03em' }}>
            TASK MANAGEMENT
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <a
            href="/tasks/dashboard"
            style={{
              color: '#fff',
              background: 'rgba(255,255,255,0.15)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              padding: '5px 12px',
              borderRadius: 5,
            }}
          >
            Dashboard
          </a>
          <a
            href="/tasks"
            style={{
              color: 'rgba(255,255,255,0.75)',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 500,
              padding: '5px 12px',
              borderRadius: 5,
            }}
          >
            Task Board
          </a>
          <span style={{ color: 'rgba(255,255,255,0.3)', margin: '0 6px' }}>|</span>
          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: '#b5833a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 13,
            fontWeight: 700,
          }}>
            {firstName.charAt(0).toUpperCase()}
          </div>
        </nav>
      </header>

      {/* ── main ── */}
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* welcome row */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
                Welcome back, {firstName}
              </h1>
              <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>
                {dateStr}
              </p>
            </div>
            {/* quick actions */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {canCreateTask && (
                <a
                  href="/tasks"
                  style={{
                    background: '#1a3a2a',
                    color: '#fff',
                    textDecoration: 'none',
                    padding: '8px 16px',
                    borderRadius: 7,
                    fontSize: 13,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  + New Task
                </a>
              )}
              <a
                href="/tasks"
                style={{
                  background: '#fff',
                  color: '#374151',
                  textDecoration: 'none',
                  padding: '8px 16px',
                  borderRadius: 7,
                  fontSize: 13,
                  fontWeight: 500,
                  border: '1px solid #d1d5db',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                Task Board
              </a>
            </div>
          </div>
        </div>

        {/* ── stat cards ── */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 32,
        }}>
          <StatCard label="Active Tasks"      value={counts.active}            accentBg="#f0fdf4" accentColor="#15803d" icon="📌" />
          <StatCard label="Due Today"         value={counts.dueToday}          accentBg="#fff7ed" accentColor="#ea580c" icon="🔔" />
          <StatCard label="Due This Week"     value={counts.dueThisWeek}       accentBg="#eff6ff" accentColor="#2563eb" icon="📅" />
          <StatCard label="Waiting"           value={counts.waiting}           accentBg="#eef2ff" accentColor="#4f46e5" icon="⏳" />
          <StatCard label="Overdue"           value={counts.overdue}           accentBg="#fef2f2" accentColor="#dc2626" icon="⚠️" />
          <StatCard label="Done This Week"    value={counts.completedThisWeek} accentBg="#f0fdf4" accentColor="#16a34a" icon="✅" />
        </div>

        {/* ── needs attention ── */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#111827', margin: 0 }}>
              Needs Your Attention
            </h2>
            {attentionTasks.length > 0 && (
              <span style={{
                background: '#fef2f2',
                color: '#b91c1c',
                fontSize: 11,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 9999,
              }}>
                {attentionTasks.length}
              </span>
            )}
          </div>

          {attentionTasks.length === 0 ? (
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              color: '#15803d',
              fontSize: 14,
              fontWeight: 500,
            }}>
              <span style={{ fontSize: 22 }}>🎉</span>
              You&apos;re all caught up — no tasks need immediate attention.
            </div>
          ) : (
            <div>
              {attentionTasks.map(t => (
                <AttentionCard key={t.id} task={t} today={todayStr} />
              ))}
            </div>
          )}
        </section>

        {/* ── upcoming + waiting (two column) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 24,
          marginBottom: 32,
        }}>
          {/* upcoming */}
          <section style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '20px 20px 8px',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              Upcoming
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>
              Tasks due soon
            </p>
            {upcomingGrouped.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                No upcoming tasks
              </p>
            ) : (
              upcomingGrouped.map(group => (
                <div key={group.label}>
                  <div style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: group.label === 'Today' ? '#ea580c' : '#6b7280',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    padding: '8px 0 2px',
                    borderTop: '1px solid #f3f4f6',
                    marginTop: 4,
                  }}>
                    {group.label}
                  </div>
                  {group.tasks.map(t => (
                    <UpcomingRow key={t.id} task={t} today={todayStr} />
                  ))}
                </div>
              ))
            )}
          </section>

          {/* waiting for */}
          <section style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '20px 20px 8px',
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              Waiting For
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>
              Tasks pending others&apos; input
            </p>
            {waitingTasks.length === 0 ? (
              <p style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                No tasks waiting
              </p>
            ) : (
              waitingTasks.map(t => (
                <WaitingRow key={t.id} task={t} />
              ))
            )}
          </section>
        </div>

        {/* ── completed this week ── */}
        {completedTasks.length > 0 && (
          <section style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 10,
            padding: '20px 20px 8px',
            marginBottom: 40,
          }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              Completed This Week
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 12px' }}>
              Tasks resolved since Monday
            </p>
            {completedTasks.map(t => (
              <CompletedRow key={t.id} task={t} />
            ))}
          </section>
        )}

        {/* footer */}
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#d1d5db', fontSize: 12 }}>
          Pabari Group · Task Management
        </div>
      </main>
    </div>
  )
}
