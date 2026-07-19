import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getFinanceSummary, getFinanceTasks } from '@/lib/db'
import Nav from '@/components/Nav'

function fmt(n: number | string) {
  return Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default async function DashboardPage() {
  const token = (await cookies()).get('fin-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) redirect('/login')

  const [summary, tasks] = await Promise.all([getFinanceSummary(), getFinanceTasks()])

  const invoiceByStatus: Record<string, { count: number; total: number }> = {}
  for (const row of summary.invoiceStats as Record<string, unknown>[]) {
    invoiceByStatus[String(row.status)] = { count: Number(row.count), total: Number(row.total) }
  }
  const paymentByStatus: Record<string, { count: number; total: number }> = {}
  for (const row of summary.paymentStats as Record<string, unknown>[]) {
    paymentByStatus[String(row.status)] = { count: Number(row.count), total: Number(row.total) }
  }
  const taskByStatus: Record<string, number> = {}
  for (const row of summary.taskStats as Record<string, unknown>[]) {
    taskByStatus[String(row.status)] = Number(row.count)
  }

  const overdueCount = Number((summary.overdue as Record<string, unknown>)?.count ?? 0)
  const overdueAmt   = Number((summary.overdue as Record<string, unknown>)?.total ?? 0)
  const totalInvoiced = Object.values(invoiceByStatus).reduce((a, b) => a + b.total, 0)
  const totalPaid     = (invoiceByStatus['paid']?.total ?? 0)
  const totalPending  = (paymentByStatus['pending']?.total ?? 0)
  const activeTasks   = tasks.filter(t => t.status !== 'resolved' && t.status !== 'expired').length

  const kpis = [
    { label: 'Total Invoiced', value: `KES ${fmt(totalInvoiced)}`, sub: `${Object.values(invoiceByStatus).reduce((a,b)=>a+b.count,0)} invoices`, color: '#2563eb' },
    { label: 'Total Collected', value: `KES ${fmt(totalPaid)}`, sub: `${invoiceByStatus['paid']?.count ?? 0} paid`, color: '#15803d' },
    { label: 'Overdue Invoices', value: `KES ${fmt(overdueAmt)}`, sub: `${overdueCount} overdue`, color: '#dc2626' },
    { label: 'Pending Payments', value: `KES ${fmt(totalPending)}`, sub: `${paymentByStatus['pending']?.count ?? 0} pending`, color: '#d97706' },
    { label: 'Active Finance Tasks', value: String(activeTasks), sub: `of ${tasks.length} total`, color: '#7c3aed' },
  ]

  const recent = tasks.slice(0, 8)

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Nav userName={user.name} />

      <main style={{ flex: 1, padding: '32px 36px', maxWidth: 1200 }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Finance Dashboard</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>Overview across all companies</p>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
          {kpis.map(k => (
            <div key={k.label} className="card" style={{ padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
                {k.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Invoice status breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Invoice Status</h2>
            {Object.entries(invoiceByStatus).map(([status, { count, total }]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge badge-${status==='paid'?'green':status==='overdue'?'red':status==='cancelled'?'gray':'yellow'}`}>
                    {status}
                  </span>
                  <span style={{ color: 'var(--muted)', fontSize: 12 }}>{count} invoices</span>
                </span>
                <span style={{ fontWeight: 600, fontSize: 13 }}>KES {fmt(total)}</span>
              </div>
            ))}
            {Object.keys(invoiceByStatus).length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No invoices yet</p>}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Finance Tasks by Status</h2>
            {Object.entries(taskByStatus).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span className={`badge badge-${status==='resolved'?'green':status==='in-review'?'blue':status==='action-required'?'red':'yellow'}`}>
                  {status}
                </span>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
            {Object.keys(taskByStatus).length === 0 && <p style={{ color: 'var(--muted)', fontSize: 13 }}>No finance tasks</p>}
          </div>
        </div>

        {/* Recent finance tasks */}
        <div className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Recent Finance Tasks</h2>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Company','Particulars','Responsible','Status','Due'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map(t => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{t.company}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, maxWidth: 280 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.particulars}</div>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{t.responsible}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`badge badge-${t.status==='resolved'?'green':t.status==='in-review'?'blue':t.status==='action-required'?'red':'yellow'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'var(--muted)' }}>{t.due_date || '—'}</td>
                  </tr>
                ))}
                {recent.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No finance tasks</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  )
}
