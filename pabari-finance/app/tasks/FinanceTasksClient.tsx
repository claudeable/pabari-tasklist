'use client'

import { useState, useMemo } from 'react'
import type { FinanceTask } from '@/lib/db'

const STATUS_BADGE: Record<string, string> = {
  'pending':         'badge-yellow',
  'in-review':       'badge-blue',
  'action-required': 'badge-red',
  'resolved':        'badge-green',
  'expired':         'badge-gray',
}
const PRIORITY_BADGE: Record<string, string> = {
  high: 'badge-red', medium: 'badge-yellow', low: 'badge-gray',
}

export default function FinanceTasksClient({ tasks }: { tasks: FinanceTask[] }) {
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('')
  const [companyF, setCompanyF] = useState('')
  const [selected, setSelected] = useState<FinanceTask | null>(null)

  const companies = useMemo(() => Array.from(new Set(tasks.map(t => t.company))).sort(), [tasks])

  const filtered = useMemo(() => tasks.filter(t => {
    if (statusF  && t.status  !== statusF)  return false
    if (companyF && t.company !== companyF) return false
    if (search) {
      const q = search.toLowerCase()
      return t.particulars.toLowerCase().includes(q) || t.responsible.toLowerCase().includes(q) || t.company.toLowerCase().includes(q)
    }
    return true
  }), [tasks, search, statusF, companyF])

  const active   = filtered.filter(t => t.status !== 'resolved' && t.status !== 'expired')
  const resolved = filtered.filter(t => t.status === 'resolved' || t.status === 'expired')

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const t of tasks) c[t.status] = (c[t.status] || 0) + 1
    return c
  }, [tasks])

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Finance Tasks</h1>
          <p className="page-sub">{tasks.length} total · {tasks.filter(t => t.status !== 'resolved' && t.status !== 'expired').length} active</p>
        </div>
        <a href="https://pabari-tasklist-production.up.railway.app/tasks" target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
          Add Task on Main Board ↗
        </a>
      </div>

      {/* Status chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {Object.entries(statusCounts).map(([s, n]) => (
          <button key={s} onClick={() => setStatusF(statusF === s ? '' : s)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999,
            border: `1px solid ${statusF === s ? 'var(--primary)' : 'var(--border)'}`,
            background: statusF === s ? 'var(--primary-light)' : 'var(--surface)',
            cursor: 'pointer', fontSize: 12, fontWeight: 600,
            color: statusF === s ? 'var(--primary)' : 'var(--muted)',
          }}>
            <span className={`badge ${STATUS_BADGE[s] ?? 'badge-gray'}`} style={{ fontSize: 10, padding: '1px 6px' }}>{s}</span>
            <span>{n}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="filter-input" type="text" placeholder="🔍  Search tasks, people, companies…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        <select className="filter-select" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="in-review">In Review</option>
          <option value="action-required">Action Required</option>
          <option value="resolved">Resolved</option>
          <option value="expired">Expired</option>
        </select>
        <select className="filter-select" value={companyF} onChange={e => setCompanyF(e.target.value)}>
          <option value="">All companies</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search || statusF || companyF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusF(''); setCompanyF('') }}>✕ Clear</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20, alignItems: 'start' }}>
        {/* Task table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {active.length > 0 && (
            <>
              <div style={{ padding: '9px 16px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-light)', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Active — {active.length}
              </div>
              <div className="table-wrap">
                <table>
                  <thead><tr>
                    <th style={{ width: 120 }}>Company</th>
                    <th>Particulars</th>
                    <th style={{ width: 150 }}>Responsible</th>
                    <th style={{ width: 110 }}>Status</th>
                    <th style={{ width: 90 }}>Priority</th>
                    <th style={{ width: 100 }}>Due</th>
                  </tr></thead>
                  <tbody>
                    {active.map(t => (
                      <tr key={t.id} className={`clickable${selected?.id === t.id ? ' selected' : ''}`} onClick={() => setSelected(selected?.id === t.id ? null : t)}>
                        <td><span className="co-tag">{t.company}</span></td>
                        <td>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{t.particulars}</div>
                          {t.hk_comment && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>💬 {t.hk_comment}</div>}
                        </td>
                        <td style={{ color: 'var(--text-2)' }}>{t.responsible}</td>
                        <td><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>{t.status}</span></td>
                        <td><span className={`badge ${PRIORITY_BADGE[t.priority] ?? 'badge-gray'}`}>{t.priority}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--muted)' }}>{t.due_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {resolved.length > 0 && (
            <>
              <div style={{ padding: '9px 16px', background: '#f0fdf4', borderTop: active.length > 0 ? '2px solid var(--border)' : undefined, borderBottom: '1px solid var(--border-light)', fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Resolved / Expired — {resolved.length}
              </div>
              <div className="table-wrap" style={{ opacity: .7 }}>
                <table>
                  <tbody>
                    {resolved.map(t => (
                      <tr key={t.id} className={`clickable${selected?.id === t.id ? ' selected' : ''}`} onClick={() => setSelected(selected?.id === t.id ? null : t)}>
                        <td style={{ width: 120 }}><span className="co-tag">{t.company}</span></td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 320 }}>{t.particulars}</td>
                        <td style={{ width: 150, color: 'var(--text-2)' }}>{t.responsible}</td>
                        <td style={{ width: 110 }}><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>{t.status}</span></td>
                        <td style={{ width: 90 }} /><td style={{ width: 100, fontSize: 12, color: 'var(--muted)' }}>{t.due_date || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {active.length === 0 && resolved.length === 0 && (
            <div className="table-empty">No finance tasks match your filters</div>
          )}
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="card" style={{ position: 'sticky', top: 20 }}>
            <div className="card-header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 2 }}>{selected.company}</div>
                <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.particulars}</div>
              </div>
              <button className="btn btn-ghost btn-xs" onClick={() => setSelected(null)}>✕</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                <span className={`badge ${STATUS_BADGE[selected.status] ?? 'badge-gray'}`}>{selected.status}</span>
                <span className={`badge ${PRIORITY_BADGE[selected.priority] ?? 'badge-gray'}`}>{selected.priority} priority</span>
              </div>
              <div className="detail-grid" style={{ marginBottom: 16 }}>
                {[
                  { label: 'Responsible', value: selected.responsible },
                  { label: 'Date',        value: selected.date || '—' },
                  { label: 'Due Date',    value: selected.due_date || '—' },
                  { label: 'Company',     value: selected.company },
                ].map(f => (
                  <div key={f.label}>
                    <div className="detail-field-label">{f.label}</div>
                    <div className="detail-field-value" style={{ marginTop: 2 }}>{f.value}</div>
                  </div>
                ))}
              </div>

              {selected.hk_comment && (
                <div style={{ marginBottom: 10 }}>
                  <div className="detail-field-label" style={{ marginBottom: 5 }}>HK Comment</div>
                  <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '9px 12px', fontSize: 13, color: '#166534' }}>{selected.hk_comment}</div>
                </div>
              )}
              {selected.hod_comment && (
                <div style={{ marginBottom: 10 }}>
                  <div className="detail-field-label" style={{ marginBottom: 5 }}>HOD Comment</div>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '9px 12px', fontSize: 13, color: '#1e40af' }}>{selected.hod_comment}</div>
                </div>
              )}
              {selected.task_updates.length > 0 && (
                <div>
                  <div className="detail-field-label" style={{ marginBottom: 8 }}>Updates ({selected.task_updates.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
                    {selected.task_updates.map(u => (
                      <div key={u.id} style={{ padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 6, border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>{u.date}</div>
                        <div style={{ fontSize: 13 }}>{u.text}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
