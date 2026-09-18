'use client'

interface Stats {
  openTasks: number
  activeTasks: number
  resolvedTasks: number
  projects: number
  docs: number
  users: number
}

interface Activity {
  actor: string
  description: string
  created_at: string
  action_type: string
}

interface Props {
  stats: Stats
  activity: Activity[]
  userName: string
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const MODULES = [
  { label: 'Tasks',               href: '/core/tasks',        icon: '✓', color: '#22c55e', bg: '#f0fdf4', desc: 'Manage and track all tasks' },
  { label: 'Project Tracker',     href: '/core/projects',     icon: '📁', color: '#6366f1', bg: '#eef2ff', desc: 'Projects and milestones' },
  { label: 'Reports',             href: '/core/reports',      icon: '📊', color: '#f59e0b', bg: '#fffbeb', desc: 'Analytics and reporting' },
  { label: 'Pabari Intelligence', href: '/core/intelligence', icon: '💡', color: '#8b5cf6', bg: '#f5f3ff', desc: 'Executive intelligence' },
  { label: 'Pabari Connect',      href: '/core/connect',      icon: '💬', color: '#0ea5e9', bg: '#f0f9ff', desc: 'Team communication hub' },
  { label: 'Pabari Centre',       href: '/core/centre',       icon: '🏛️', color: '#ef4444', bg: '#fef2f2', desc: 'Company forms and requests' },
  { label: 'Documents',           href: '/core/documents',    icon: '📄', color: '#64748b', bg: '#f8fafc', desc: 'Files and document library' },
]

export default function CoreDashboard({ stats, activity, userName }: Props) {
  const firstName = userName.split(' ')[0]

  const KPI = ({ label, value, sub, color }: { label: string; value: number; sub?: string; color: string }) => (
    <div style={{ background: 'white', borderRadius: 12, padding: '20px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value.toLocaleString()}</div>
      {sub && <div style={{ fontSize: 12, color: '#94a3b8' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          {getGreeting()}, {firstName}
        </div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Dashboard</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#64748b' }}>Overview of all activity across Pabari Kenya</p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 16, marginBottom: 32 }}>
        <KPI label="Open Tasks"     value={stats.openTasks}     color="#ef4444" sub="awaiting action" />
        <KPI label="In Progress"    value={stats.activeTasks}   color="#f59e0b" sub="actively worked on" />
        <KPI label="Resolved (30d)" value={stats.resolvedTasks} color="#22c55e" sub="completed this month" />
        <KPI label="Active Projects" value={stats.projects}     color="#6366f1" sub="planning + active" />
        <KPI label="Documents"       value={stats.docs}         color="#0ea5e9" sub="total files" />
        <KPI label="Active Users"    value={stats.users}        color="#8b5cf6" sub="team members" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, alignItems: 'start' }}>

        {/* Module launcher */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Modules</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {MODULES.map(m => (
              <a key={m.href} href={m.href} style={{ textDecoration: 'none', display: 'block' }}>
                <div
                  style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '18px 20px', transition: 'all 0.13s', cursor: 'pointer' }}
                  onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; el.style.transform = 'translateY(-2px)'; el.style.borderColor = m.color }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = 'none'; el.style.transform = 'translateY(0)'; el.style.borderColor = '#e2e8f0' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, marginBottom: 10 }}>{m.icon}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.desc}</div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Recent Activity</div>
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
            {activity.length === 0 && (
              <div style={{ padding: '24px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No recent activity.</div>
            )}
            {activity.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: i < activity.length - 1 ? '1px solid #f1f5f9' : 'none', alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#1a3a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#22c55e', flexShrink: 0, marginTop: 1 }}>
                  {(a.actor || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: '#1e293b', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    <strong style={{ fontWeight: 600 }}>{a.actor}</strong> {a.description}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{fmtRelative(a.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
