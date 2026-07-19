import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getFinanceSummary, getFinanceTasks, getInvoices, getPayments } from '@/lib/db'
import Nav from '@/components/Nav'

const COMPANIES = ['BERLIN_BNK','BYTEWISE','DR.PHARMA','EPPL','EURO TOWERS','GHPL','IIGENTRA','KISCOL','MALEE','MALI CREDIT','MAXITOWER','MERCURY','PDL','PIL','UNIFRESH','USM','WELWYN']

function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n/1_000).toFixed(0)}K`
  return n.toFixed(0)
}
function fmt(n: number) { return Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

const STATUS_BADGE: Record<string, string> = {
  'pending': 'badge-yellow', 'in-review': 'badge-blue',
  'action-required': 'badge-red', 'resolved': 'badge-green', 'expired': 'badge-gray',
}

export default async function DashboardPage() {
  const token = (await cookies()).get('fin-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) redirect('/login')

  const [summary, tasks, invoices, payments] = await Promise.all([
    getFinanceSummary(), getFinanceTasks(), getInvoices(), getPayments(),
  ])

  // Invoice stats
  const invByStatus: Record<string, { count: number; total: number }> = {}
  for (const r of summary.invoiceStats as Record<string,unknown>[])
    invByStatus[String(r.status)] = { count: Number(r.count), total: Number(r.total) }

  const payByStatus: Record<string, { count: number; total: number }> = {}
  for (const r of summary.paymentStats as Record<string,unknown>[])
    payByStatus[String(r.status)] = { count: Number(r.count), total: Number(r.total) }

  const taskByStatus: Record<string, number> = {}
  for (const r of summary.taskStats as Record<string,unknown>[])
    taskByStatus[String(r.status)] = Number(r.count)

  const overdueCount = Number((summary.overdue as Record<string,unknown>)?.count ?? 0)
  const overdueAmt   = Number((summary.overdue as Record<string,unknown>)?.total ?? 0)
  const totalInvoiced = Object.values(invByStatus).reduce((a,b) => a + b.total, 0)
  const totalPaid     = invByStatus['paid']?.total ?? 0
  const totalConfirmed = payByStatus['confirmed']?.total ?? 0
  const totalPending   = payByStatus['pending']?.total ?? 0
  const activeTasks    = tasks.filter(t => t.status !== 'resolved' && t.status !== 'expired').length

  // Per-company breakdown
  const coMap: Record<string, { invoiced: number; paid: number; payments: number; tasks: number }> = {}
  for (const co of COMPANIES) coMap[co] = { invoiced: 0, paid: 0, payments: 0, tasks: 0 }
  for (const inv of invoices) {
    if (coMap[inv.company]) {
      coMap[inv.company].invoiced += inv.amount
      if (inv.status === 'paid') coMap[inv.company].paid += inv.amount
    }
  }
  for (const p of payments) { if (coMap[p.company]) coMap[p.company].payments += p.amount }
  for (const t of tasks) {
    if (coMap[t.company] && t.status !== 'resolved' && t.status !== 'expired')
      coMap[t.company].tasks++
  }
  const activeCompanies = COMPANIES.filter(co => coMap[co].invoiced > 0 || coMap[co].tasks > 0)

  const recentTasks = tasks.slice(0, 6)

  return (
    <div className="layout">
      <Nav userName={user.name} userEmail={user.email} />
      <main className="main-content">

        {/* Header */}
        <div className="page-header">
          <div>
            <h1 className="page-title">Finance Dashboard</h1>
            <p className="page-sub">Live overview across all 17 companies</p>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'right' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{new Date().toLocaleDateString('en-KE', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          {[
            { icon: '🧾', label: 'Total Invoiced',   value: `KES ${fmtK(totalInvoiced)}`, full: fmt(totalInvoiced), sub: `${Object.values(invByStatus).reduce((a,b)=>a+b.count,0)} invoices`, color: '#2563eb' },
            { icon: '✅', label: 'Total Collected',  value: `KES ${fmtK(totalPaid)}`,     full: fmt(totalPaid),     sub: `${invByStatus['paid']?.count ?? 0} paid invoices`,   color: '#15803d' },
            { icon: '⚠️', label: 'Overdue',          value: `KES ${fmtK(overdueAmt)}`,    full: fmt(overdueAmt),    sub: `${overdueCount} overdue invoices`,  color: '#dc2626' },
            { icon: '💸', label: 'Confirmed Payments',value: `KES ${fmtK(totalConfirmed)}`,full: fmt(totalConfirmed),sub: `${payByStatus['confirmed']?.count ?? 0} confirmed`, color: '#7c3aed' },
            { icon: '⏳', label: 'Pending Payments', value: `KES ${fmtK(totalPending)}`,  full: fmt(totalPending),  sub: `${payByStatus['pending']?.count ?? 0} pending`,      color: '#d97706' },
            { icon: '📋', label: 'Active Tasks',     value: String(activeTasks),           full: '',                 sub: `of ${tasks.length} total finance tasks`,             color: '#0891b2' },
          ].map(k => (
            <div key={k.label} className="kpi-card" title={k.full ? `KES ${k.full}` : ''}>
              <span className="kpi-icon">{k.icon}</span>
              <div className="kpi-label">{k.label}</div>
              <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Two column: status breakdowns */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

          {/* Invoice status */}
          <div className="card">
            <div className="card-header"><span className="card-title">Invoice Status Breakdown</span></div>
            <div className="card-body" style={{ padding: '12px 20px' }}>
              {Object.keys(invByStatus).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>No invoices yet</p>
              ) : Object.entries(invByStatus).map(([status, { count, total }]) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`badge badge-${status==='paid'?'green':status==='overdue'?'red':status==='approved'?'blue':status==='cancelled'?'gray':'yellow'}`}>{status}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>{count} {count === 1 ? 'invoice' : 'invoices'}</span>
                  </div>
                  <span className="amount">KES {fmt(total)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Finance tasks by status */}
          <div className="card">
            <div className="card-header"><span className="card-title">Finance Tasks by Status</span></div>
            <div className="card-body" style={{ padding: '12px 20px' }}>
              {Object.keys(taskByStatus).length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>No finance tasks</p>
              ) : Object.entries(taskByStatus).map(([status, count]) => {
                const total = tasks.length
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={status} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-light)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className={`badge ${STATUS_BADGE[status] ?? 'badge-gray'}`}>{status}</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{count}</span>
                    </div>
                    <div className="progress-wrap">
                      <div className="progress-bar" style={{ width: `${pct}%`, background: status==='resolved'?'#15803d':status==='in-review'?'#2563eb':status==='action-required'?'#dc2626':'#d97706' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Company breakdown */}
        {activeCompanies.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header">
              <span className="card-title">Company Breakdown</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{activeCompanies.length} of 17 companies active</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Total Invoiced</th>
                    <th>Paid</th>
                    <th>Payments</th>
                    <th>Active Tasks</th>
                    <th>Collection Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCompanies.map(co => {
                    const d = coMap[co]
                    const rate = d.invoiced > 0 ? Math.round((d.paid / d.invoiced) * 100) : 0
                    return (
                      <tr key={co}>
                        <td><span className="co-tag">{co}</span></td>
                        <td className="amount">{d.invoiced > 0 ? `KES ${fmt(d.invoiced)}` : '—'}</td>
                        <td className="amount amount-pos">{d.paid > 0 ? `KES ${fmt(d.paid)}` : '—'}</td>
                        <td className="amount">{d.payments > 0 ? `KES ${fmt(d.payments)}` : '—'}</td>
                        <td>
                          {d.tasks > 0
                            ? <span className="badge badge-orange">{d.tasks} active</span>
                            : <span style={{ color: 'var(--muted)', fontSize: 12 }}>None</span>
                          }
                        </td>
                        <td>
                          {d.invoiced > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="progress-wrap" style={{ width: 80 }}>
                                <div className="progress-bar" style={{ width: `${rate}%`, background: rate >= 80 ? '#15803d' : rate >= 50 ? '#d97706' : '#dc2626' }} />
                              </div>
                              <span style={{ fontSize: 12, fontWeight: 600 }}>{rate}%</span>
                            </div>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent tasks */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Finance Tasks</span>
            <a href="/tasks" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }}>View all →</a>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Particulars</th>
                  <th>Responsible</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {recentTasks.map(t => (
                  <tr key={t.id}>
                    <td><span className="co-tag">{t.company}</span></td>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.particulars}</div>
                    </td>
                    <td style={{ color: 'var(--text-2)' }}>{t.responsible}</td>
                    <td><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>{t.status}</span></td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{t.due_date || '—'}</td>
                  </tr>
                ))}
                {recentTasks.length === 0 && (
                  <tr><td colSpan={5} className="table-empty">No finance tasks yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  )
}
