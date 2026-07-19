'use client'

import { useState, useMemo } from 'react'
import type { FinanceTask } from '@/lib/db'

const STATUS_COLORS: Record<string, string> = {
  'pending':         'badge-yellow',
  'in-review':       'badge-blue',
  'action-required': 'badge-red',
  'resolved':        'badge-green',
  'expired':         'badge-gray',
}

export default function FinanceTasksClient({ tasks }: { tasks: FinanceTask[] }) {
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [companyFilter, setCompany] = useState('')
  const [selected, setSelected]   = useState<FinanceTask | null>(null)

  const companies = useMemo(() => Array.from(new Set(tasks.map(t => t.company))).sort(), [tasks])

  const filtered = useMemo(() => tasks.filter(t => {
    if (statusFilter && t.status !== statusFilter) return false
    if (companyFilter && t.company !== companyFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return t.particulars.toLowerCase().includes(q) || t.responsible.toLowerCase().includes(q) || t.company.toLowerCase().includes(q)
    }
    return true
  }), [tasks, search, statusFilter, companyFilter])

  const active   = filtered.filter(t => t.status !== 'resolved' && t.status !== 'expired')
  const resolved = filtered.filter(t => t.status === 'resolved' || t.status === 'expired')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Finance Tasks</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>{tasks.length} total · {active.length} active</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <input
          type="text"
          placeholder="Search tasks…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: 260 }}
        />
        <select value={statusFilter} onChange={e => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-review">In Review</option>
          <option value="action-required">Action Required</option>
          <option value="resolved">Resolved</option>
          <option value="expired">Expired</option>
        </select>
        <select value={companyFilter} onChange={e => setCompany(e.target.value)} style={{ width: 160 }}>
          <option value="">All companies</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || statusFilter || companyFilter) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatus(''); setCompany('') }}>
            Clear
          </button>
        )}
      </div>

      {/* Task list */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', display: 'grid', gridTemplateColumns: '120px 1fr 160px 100px 100px' }}>
          <span>Company</span><span>Particulars</span><span>Responsible</span><span>Status</span><span>Due</span>
        </div>

        {active.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No active finance tasks match your filters</div>
        )}

        {active.map(t => (
          <div
            key={t.id}
            onClick={() => setSelected(t)}
            style={{
              display: 'grid', gridTemplateColumns: '120px 1fr 160px 100px 100px',
              alignItems: 'center', padding: '12px 20px',
              borderBottom: '1px solid var(--border)', cursor: 'pointer',
              background: selected?.id === t.id ? '#f0fdf4' : undefined,
              transition: 'background .1s',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 600 }}>{t.company}</span>
            <span style={{ fontSize: 13, paddingRight: 16 }}>{t.particulars}</span>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.responsible}</span>
            <span><span className={`badge ${STATUS_COLORS[t.status] ?? 'badge-gray'}`}>{t.status}</span></span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.due_date || '—'}</span>
          </div>
        ))}

        {resolved.length > 0 && (
          <>
            <div style={{ padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' }}>
              Resolved / Expired ({resolved.length})
            </div>
            {resolved.map(t => (
              <div
                key={t.id}
                onClick={() => setSelected(t)}
                style={{
                  display: 'grid', gridTemplateColumns: '120px 1fr 160px 100px 100px',
                  alignItems: 'center', padding: '12px 20px',
                  borderBottom: '1px solid var(--border)', cursor: 'pointer',
                  opacity: .65, background: selected?.id === t.id ? '#f0fdf4' : undefined,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600 }}>{t.company}</span>
                <span style={{ fontSize: 13, paddingRight: 16 }}>{t.particulars}</span>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t.responsible}</span>
                <span><span className={`badge ${STATUS_COLORS[t.status] ?? 'badge-gray'}`}>{t.status}</span></span>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t.due_date || '—'}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{selected.company}</div>
              <h2 style={{ fontSize: 17, fontWeight: 700, maxWidth: 600 }}>{selected.particulars}</h2>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕ Close</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Status',      value: <span className={`badge ${STATUS_COLORS[selected.status]??'badge-gray'}`}>{selected.status}</span> },
              { label: 'Responsible', value: selected.responsible },
              { label: 'Date',        value: selected.date },
              { label: 'Due Date',    value: selected.due_date || '—' },
              { label: 'Priority',    value: selected.priority },
            ].map(f => (
              <div key={f.label}>
                <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 14 }}>{f.value}</div>
              </div>
            ))}
          </div>

          {selected.hk_comment && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>HK Comment</div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>{selected.hk_comment}</div>
            </div>
          )}

          {selected.hod_comment && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>HOD Comment</div>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>{selected.hod_comment}</div>
            </div>
          )}

          {selected.task_updates.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 10 }}>Updates</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.task_updates.map(u => (
                  <div key={u.id} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 6, fontSize: 13 }}>
                    <div style={{ color: 'var(--muted)', fontSize: 11, marginBottom: 4 }}>{u.date}</div>
                    {u.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
