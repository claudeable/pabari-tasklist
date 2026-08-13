'use client'

import { useMemo, useState } from 'react'

/* ── exported types (consumed by server page) ─────────────── */
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

export interface WeekDay {
  date: string
  label: string
  dueCount: number
  isToday: boolean
  isPast: boolean
}

interface Props {
  user: { name: string; email: string; role: string }
  counts: DashboardCounts
  attentionTasks: DashboardTask[]
  upcomingTasks: DashboardTask[]
  waitingTasks: DashboardTask[]
  completedTasks: DashboardTask[]
  weekDays: WeekDay[]
  weekSummary: { completed: number; active: number; overdue: number }
  canCreateTask: boolean
  todayStr: string
  kenyaHour: number
}

/* ── design tokens ─────────────────────────────────────────── */
const C = {
  bg:         '#f1f5f9',
  card:       '#ffffff',
  border:     '#e2e8f0',
  borderHover:'#cbd5e1',
  green:      '#1a3a2a',
  gold:       '#b5833a',
  text:       '#0f172a',
  textSub:    '#475569',
  textMuted:  '#94a3b8',
  red:        '#dc2626',
  orange:     '#ea580c',
  violet:     '#7c3aed',
  emerald:    '#16a34a',
  amber:      '#d97706',
  blue:       '#2563eb',
}

const FONT = '"Inter", "Segoe UI", system-ui, -apple-system, sans-serif'

/* ── status helpers ─────────────────────────────────────────── */
const STATUS_HUMAN: Record<string, string> = {
  'pending-discussion':    'Pending discussion',
  'action-required':       'Action needed',
  'in-review':             'Under review',
  'awaiting-hod-approval': 'Awaiting HOD approval',
  'awaiting-hk-approval':  'Awaiting HK approval',
  'resolved':              'Completed',
  'expired':               'Expired',
  'archived':              'Archived',
}

const WAITING_HUMAN: Record<string, string> = {
  'pending-discussion':    'Waiting for discussion',
  'in-review':             'Under review',
  'awaiting-hod-approval': 'Awaiting HOD approval',
  'awaiting-hk-approval':  'Awaiting HK approval',
}

const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  'pending-discussion':    { bg: '#f1f5f9', color: '#475569' },
  'action-required':       { bg: '#fef2f2', color: '#b91c1c' },
  'in-review':             { bg: '#eff6ff', color: '#1d4ed8' },
  'awaiting-hod-approval': { bg: '#fffbeb', color: '#92400e' },
  'awaiting-hk-approval':  { bg: '#fffbeb', color: '#92400e' },
  'resolved':              { bg: '#f0fdf4', color: '#15803d' },
}

const PRIORITY_BAR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#94a3b8',
}

/* ── date helpers (client-side) ────────────────────────────── */
function parseDueDate(due: string): Date | null {
  if (!due) return null
  const d = new Date(due + 'T12:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

function formatDueDisplay(due: string, todayStr: string): { label: string; color: string; isOverdue: boolean } {
  if (!due) return { label: '', color: C.textMuted, isOverdue: false }
  if (due < todayStr) {
    const days = Math.round((new Date(todayStr).getTime() - new Date(due + 'T12:00:00Z').getTime()) / 86_400_000)
    return { label: `${days}d overdue`, color: C.red, isOverdue: true }
  }
  if (due === todayStr) return { label: 'Due today', color: C.orange, isOverdue: false }
  const d = parseDueDate(due)
  if (!d) return { label: '', color: C.textMuted, isOverdue: false }
  const tomorrow = new Date(todayStr + 'T12:00:00Z')
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (due === tomorrow.toISOString().slice(0, 10)) return { label: 'Due tomorrow', color: C.amber, isOverdue: false }
  return {
    label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' }),
    color: C.textSub,
    isOverdue: false,
  }
}

function formatUpcomingDate(due: string): string {
  const d = parseDueDate(due)
  if (!d) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Nairobi' }).toUpperCase()
}

function formatCompletedWhen(updated_at: string, todayStr: string): string {
  if (!updated_at) return ''
  const d = new Date(updated_at)
  if (isNaN(d.getTime())) return ''
  const eat = new Date(d.getTime() + 3 * 3600 * 1000)
  const dateStr = eat.toISOString().slice(0, 10)
  if (dateStr === todayStr) return 'Completed today'
  const yesterday = new Date(todayStr + 'T12:00:00Z')
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Completed yesterday'
  const parsed = parseDueDate(dateStr)
  if (!parsed) return ''
  return 'Completed ' + parsed.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })
}

function taskUrl(id: string) { return `/tasks?id=${id}` }

/* ── tiny reusables ─────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.07em',
      textTransform: 'uppercase',
      color: C.textMuted,
      margin: '0 0 14px',
    }}>
      {children}
    </p>
  )
}

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      background: bg,
      color,
      fontSize: 11,
      fontWeight: 600,
      padding: '2px 7px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
    }}>
      {label}
    </span>
  )
}

/* ── Stat Card ──────────────────────────────────────────────── */
function StatCard({
  label, value, description,
  numColor, icon,
}: {
  label: string
  value: number
  description: string
  numColor: string
  icon: string
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${hov ? C.borderHover : C.border}`,
        borderRadius: 10,
        padding: '18px 20px',
        flex: '1 1 140px',
        cursor: 'default',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: hov ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.textMuted, margin: '0 0 8px' }}>
            {label}
          </p>
          <p style={{ fontSize: 34, fontWeight: 700, color: numColor, lineHeight: 1, margin: '0 0 6px' }}>
            {value}
          </p>
          <p style={{ fontSize: 12, color: C.textSub, margin: 0 }}>
            {description}
          </p>
        </div>
        <span style={{ fontSize: 18, opacity: 0.5 }}>{icon}</span>
      </div>
    </div>
  )
}

/* ── Attention task card ─────────────────────────────────────── */
function AttentionCard({ task, todayStr }: { task: DashboardTask; todayStr: string }) {
  const [hov, setHov] = useState(false)
  const due = formatDueDisplay(task.due_date, todayStr)
  const bar = PRIORITY_BAR[task.priority] ?? C.textMuted
  const pill = STATUS_PILL[task.status] ?? { bg: '#f1f5f9', color: C.textSub }

  return (
    <a
      href={taskUrl(task.id)}
      style={{ textDecoration: 'none', display: 'block', marginBottom: 8 }}
    >
      <div
        style={{
          background: C.card,
          border: `1px solid ${hov ? C.borderHover : C.border}`,
          borderLeft: `3px solid ${due.isOverdue ? C.red : bar}`,
          borderRadius: '0 8px 8px 0',
          padding: '14px 16px',
          display: 'flex',
          gap: 14,
          alignItems: 'flex-start',
          boxShadow: hov ? '0 2px 8px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)',
          transition: 'all 0.15s',
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Priority label */}
          {task.priority === 'high' && (
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: C.red, textTransform: 'uppercase', margin: '0 0 4px' }}>
              HIGH PRIORITY
            </p>
          )}
          {/* Task name */}
          <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: '0 0 3px', lineHeight: 1.4 }}>
            {task.particulars}
          </p>
          {/* Company · Section */}
          <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 10px' }}>
            {task.company}{task.section ? ` · ${task.section}` : ''}
          </p>
          {/* Latest update snippet */}
          {task.latestUpdate && (
            <p style={{
              fontSize: 12,
              color: C.textSub,
              background: '#f8fafc',
              borderRadius: 5,
              padding: '5px 8px',
              margin: '0 0 10px',
              lineHeight: 1.5,
              fontStyle: 'italic',
              borderLeft: '2px solid #e2e8f0',
            }}>
              {task.latestUpdate.length > 100 ? task.latestUpdate.slice(0, 100) + '…' : task.latestUpdate}
            </p>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Pill label={STATUS_HUMAN[task.status] ?? task.status} bg={pill.bg} color={pill.color} />
          </div>
        </div>

        {/* Right side */}
        <div style={{ textAlign: 'right', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          {due.label && (
            <span style={{ fontSize: 12, fontWeight: 600, color: due.color, whiteSpace: 'nowrap' }}>
              {due.isOverdue ? '⚠ ' : ''}{due.label}
            </span>
          )}
          <span style={{ fontSize: 12, color: C.gold, fontWeight: 600 }}>
            Open task →
          </span>
        </div>
      </div>
    </a>
  )
}

/* ── Week panel ──────────────────────────────────────────────── */
function WeekPanel({
  weekDays,
  summary,
}: {
  weekDays: WeekDay[]
  summary: { completed: number; active: number; overdue: number }
}) {
  const maxDue = Math.max(...weekDays.map(d => d.dueCount), 1)

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '20px',
      height: '100%',
      boxSizing: 'border-box',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
    }}>
      <SectionLabel>Your week</SectionLabel>

      {/* Day columns */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 20, height: 72 }}>
        {weekDays.map(day => {
          const barH = day.dueCount > 0 ? Math.max(20, Math.round((day.dueCount / maxDue) * 56)) : 4
          const barColor = day.isToday ? C.green : day.isPast ? '#e2e8f0' : '#cbd5e1'
          const textColor = day.isToday ? C.green : day.isPast ? C.textMuted : C.textSub
          return (
            <div key={day.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ width: '100%', position: 'relative', height: 56, display: 'flex', alignItems: 'flex-end' }}>
                <div style={{
                  width: '100%',
                  height: barH,
                  background: barColor,
                  borderRadius: 3,
                  transition: 'height 0.3s ease',
                }} />
                {day.dueCount > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: barH < 24 ? -16 : 4,
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: day.isToday ? C.green : C.textMuted,
                  }}>
                    {day.dueCount}
                  </span>
                )}
              </div>
              <span style={{
                fontSize: 10,
                fontWeight: day.isToday ? 700 : 500,
                color: textColor,
                letterSpacing: '0.04em',
              }}>
                {day.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Summary stats */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        paddingTop: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.textSub }}>Completed</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.emerald }}>{summary.completed}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.textSub }}>Active</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{summary.active}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: C.textSub }}>Overdue</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: summary.overdue > 0 ? C.red : C.textMuted }}>
            {summary.overdue}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ── Waiting row ─────────────────────────────────────────────── */
function WaitingRow({ task, todayStr }: { task: DashboardTask; todayStr: string }) {
  const [hov, setHov] = useState(false)
  const due = task.due_date ? formatDueDisplay(task.due_date, todayStr) : null
  const humanStatus = WAITING_HUMAN[task.status] ?? STATUS_HUMAN[task.status] ?? task.status

  return (
    <a href={taskUrl(task.id)} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          padding: '11px 0',
          borderBottom: `1px solid ${C.border}`,
          alignItems: 'flex-start',
          transition: 'background 0.1s',
          borderRadius: hov ? 4 : 0,
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        <div style={{
          width: 28,
          height: 28,
          borderRadius: 6,
          background: '#fffbeb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          flexShrink: 0,
          marginTop: 1,
        }}>
          ⏳
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontSize: 13,
            fontWeight: 500,
            color: C.text,
            margin: '0 0 2px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {task.particulars}
          </p>
          <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
            {task.company}
          </p>
          <p style={{ fontSize: 11, color: C.textSub, margin: '3px 0 0', fontStyle: 'italic' }}>
            {humanStatus}
            {due && due.label ? ` · ${due.label}` : ''}
          </p>
        </div>
        {hov && (
          <span style={{ fontSize: 11, color: C.gold, fontWeight: 600, flexShrink: 0, alignSelf: 'center' }}>→</span>
        )}
      </div>
    </a>
  )
}

/* ── Upcoming section ────────────────────────────────────────── */
function UpcomingSection({ tasks, todayStr }: { tasks: DashboardTask[]; todayStr: string }) {
  // Group by date label
  const groups: { label: string; items: DashboardTask[] }[] = []
  const seen = new Map<string, DashboardTask[]>()
  for (const t of tasks) {
    const label = formatUpcomingDate(t.due_date)
    if (!seen.has(label)) {
      seen.set(label, [])
      groups.push({ label, items: seen.get(label)! })
    }
    seen.get(label)!.push(t)
  }

  return (
    <>
      {groups.map(group => (
        <div key={group.label} style={{ marginBottom: 4 }}>
          <p style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: group.label.includes(formatUpcomingDate(todayStr)) ? C.orange : C.textMuted,
            margin: '12px 0 4px',
            textTransform: 'uppercase',
          }}>
            {group.label}
          </p>
          {group.items.map(t => {
            const pill = STATUS_PILL[t.status] ?? { bg: '#f1f5f9', color: C.textSub }
            return (
              <UpcomingRow key={t.id} task={t} pill={pill} />
            )
          })}
        </div>
      ))}
    </>
  )
}

function UpcomingRow({ task, pill }: { task: DashboardTask; pill: { bg: string; color: string } }) {
  const [hov, setHov] = useState(false)
  const bar = PRIORITY_BAR[task.priority] ?? C.textMuted
  return (
    <a href={taskUrl(task.id)} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 8px',
          borderRadius: 6,
          background: hov ? '#f8fafc' : 'transparent',
          transition: 'background 0.1s',
          marginBottom: 2,
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        <div style={{ width: 3, height: 28, borderRadius: 2, background: bar, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.particulars}
          </p>
          <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{task.company}</p>
        </div>
        <Pill label={STATUS_HUMAN[task.status] ?? task.status} bg={pill.bg} color={pill.color} />
      </div>
    </a>
  )
}

/* ── Completed row ───────────────────────────────────────────── */
function CompletedRow({ task, todayStr }: { task: DashboardTask; todayStr: string }) {
  const [hov, setHov] = useState(false)
  const when = formatCompletedWhen(task.updated_at, todayStr)
  return (
    <a href={taskUrl(task.id)} style={{ textDecoration: 'none', display: 'block' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '11px 0',
          borderBottom: `1px solid ${C.border}`,
          transition: 'opacity 0.1s',
          opacity: hov ? 0.75 : 1,
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
      >
        <div style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#dcfce7',
          border: `1.5px solid ${C.emerald}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          fontSize: 10,
          color: C.emerald,
          fontWeight: 700,
        }}>
          ✓
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: C.textSub, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'line-through', textDecorationColor: '#94a3b8' }}>
            {task.particulars}
          </p>
          <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>{task.company}</p>
        </div>
        {when && (
          <span style={{ fontSize: 11, color: C.emerald, fontWeight: 500, flexShrink: 0 }}>{when}</span>
        )}
      </div>
    </a>
  )
}

/* ── Card shell ──────────────────────────────────────────────── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      padding: '20px',
      boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  )
}

/* ── Main dashboard ──────────────────────────────────────────── */
export default function TaskDashboard({
  user, counts, attentionTasks, upcomingTasks, waitingTasks,
  completedTasks, weekDays, weekSummary, canCreateTask, todayStr, kenyaHour,
}: Props) {
  const firstName = user.name.split(' ')[0]

  const greeting = kenyaHour < 12 ? 'Good morning' : kenyaHour < 17 ? 'Good afternoon' : 'Good evening'

  const dateLabel = useMemo(() => {
    const d = new Date(todayStr + 'T12:00:00Z')
    return d.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }, [todayStr])

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: FONT }}>

      {/* ── Header ── */}
      <header style={{
        background: C.green,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 32px',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <span style={{
              background: C.gold,
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.1em',
              padding: '3px 8px',
              borderRadius: 4,
            }}>
              PABARI
            </span>
          </a>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, lineHeight: 1 }}>|</span>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em' }}>
            TASK MANAGEMENT
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {[
            { label: 'Dashboard', href: '/tasks/dashboard', active: true },
            { label: 'My Tasks',  href: '/tasks/board' },
            { label: 'Task Board', href: '/tasks/board' },
          ].map(({ label, href, active }) => (
            <a
              key={label}
              href={href}
              style={{
                color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                padding: '5px 12px',
                borderRadius: 5,
                background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
              }}
            >
              {label}
            </a>
          ))}
          {canCreateTask && (
            <a
              href="/tasks/board"
              style={{
                color: C.green,
                background: '#fff',
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 700,
                padding: '5px 12px',
                borderRadius: 5,
                marginLeft: 8,
              }}
            >
              + New Task
            </a>
          )}
          <div style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: C.gold,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            marginLeft: 12,
          }}>
            {firstName.charAt(0).toUpperCase()}
          </div>
        </nav>
      </header>

      {/* ── Main content ── */}
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 32px 48px' }}>

        {/* Greeting row */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>
              {greeting}, {firstName} 👋
            </h1>
            <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>{dateLabel}</p>
          </div>
          <a
            href="/tasks/board"
            style={{
              background: C.green,
              color: '#fff',
              textDecoration: 'none',
              padding: '9px 20px',
              borderRadius: 7,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            My Tasks →
          </a>
        </div>

        {/* ── Stat cards ── */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
          <StatCard
            label="Active"
            value={counts.active}
            description={counts.active === 1 ? 'task in progress' : 'tasks in progress'}
            numColor={C.text}
            icon="📌"
          />
          <StatCard
            label="Due Today"
            value={counts.dueToday}
            description={counts.dueToday === 0 ? 'nothing due today' : counts.dueToday === 1 ? 'due today' : 'due today'}
            numColor={counts.dueToday > 0 ? C.orange : C.emerald}
            icon="🔔"
          />
          <StatCard
            label="Due This Week"
            value={counts.dueThisWeek}
            description={counts.dueThisWeek === 0 ? 'clear for the week' : 'due this week'}
            numColor={counts.dueThisWeek > 0 ? C.blue : C.emerald}
            icon="📅"
          />
          <StatCard
            label="Waiting"
            value={counts.waiting}
            description={counts.waiting === 0 ? 'no pending items' : counts.waiting === 1 ? 'follow-up needed' : 'follow-ups needed'}
            numColor={counts.waiting > 0 ? C.violet : C.textMuted}
            icon="⏳"
          />
          <StatCard
            label="Overdue"
            value={counts.overdue}
            description={counts.overdue === 0 ? "you're on track" : counts.overdue === 1 ? 'needs attention' : 'need attention'}
            numColor={counts.overdue > 0 ? C.red : C.emerald}
            icon="⚠"
          />
          <StatCard
            label="Done This Week"
            value={counts.completedThisWeek}
            description={counts.completedThisWeek === 0 ? 'none yet' : counts.completedThisWeek === 1 ? 'completed' : 'completed'}
            numColor={counts.completedThisWeek > 0 ? C.emerald : C.textMuted}
            icon="✓"
          />
        </div>

        {/* ── Attention + Week (2:1) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 260px',
          gap: 16,
          marginBottom: 16,
          alignItems: 'start',
        }}>
          {/* Needs Your Attention */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <SectionLabel>Needs your attention</SectionLabel>
              {attentionTasks.length > 0 && (
                <span style={{
                  background: '#fef2f2',
                  color: C.red,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 9999,
                }}>
                  {attentionTasks.length}
                </span>
              )}
            </div>

            {attentionTasks.length === 0 ? (
              <div style={{
                padding: '28px 0',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: '#dcfce7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 18,
                  color: C.emerald,
                  fontWeight: 700,
                }}>
                  ✓
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.emerald, margin: 0 }}>
                  You&apos;re all caught up
                </p>
                <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>
                  No tasks currently require your attention.
                </p>
              </div>
            ) : (
              attentionTasks.map(t => (
                <AttentionCard key={t.id} task={t} todayStr={todayStr} />
              ))
            )}
          </Card>

          {/* Week panel */}
          <WeekPanel weekDays={weekDays} summary={weekSummary} />
        </div>

        {/* ── Waiting + Upcoming (1:1) ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 16,
          alignItems: 'start',
        }}>
          {/* Waiting For */}
          <Card>
            <SectionLabel>Waiting for</SectionLabel>
            <p style={{ fontSize: 12, color: C.textMuted, margin: '-8px 0 14px', lineHeight: 1.5 }}>
              Tasks pending others&apos; input
            </p>
            {waitingTasks.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>No tasks waiting right now.</p>
              </div>
            ) : (
              waitingTasks.map(t => (
                <WaitingRow key={t.id} task={t} todayStr={todayStr} />
              ))
            )}
          </Card>

          {/* Upcoming */}
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <SectionLabel>Upcoming</SectionLabel>
              <a href="/tasks/board" style={{ fontSize: 11, color: C.gold, fontWeight: 600, textDecoration: 'none' }}>
                View all →
              </a>
            </div>
            {upcomingTasks.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: C.textMuted, margin: 0 }}>No upcoming tasks.</p>
              </div>
            ) : (
              <UpcomingSection tasks={upcomingTasks} todayStr={todayStr} />
            )}
          </Card>
        </div>

        {/* ── Completed This Week ── */}
        {completedTasks.length > 0 && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <SectionLabel>Completed this week</SectionLabel>
              <a href="/tasks/board" style={{ fontSize: 11, color: C.gold, fontWeight: 600, textDecoration: 'none' }}>
                View all →
              </a>
            </div>
            <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 14px' }}>
              Tasks resolved since Monday
            </p>
            {completedTasks.map(t => (
              <CompletedRow key={t.id} task={t} todayStr={todayStr} />
            ))}
          </Card>
        )}

        {/* Footer */}
        <p style={{ textAlign: 'center', fontSize: 11, color: C.textMuted, marginTop: 40 }}>
          Pabari Group · Task Management
        </p>
      </main>

      {/* Responsive styles */}
      <style>{`
        @media (max-width: 1024px) {
          main > div:nth-child(4) {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 768px) {
          main > div:nth-child(3) { flex-direction: column !important; }
          main > div:nth-child(4),
          main > div:nth-child(5) {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 640px) {
          main > div:nth-child(2) { gap: 8px !important; }
          main > div:nth-child(2) > div { flex: 1 1 calc(50% - 4px) !important; }
        }
      `}</style>
    </div>
  )
}
