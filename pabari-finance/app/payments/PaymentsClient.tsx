'use client'

import { useState, useMemo } from 'react'
import type { Payment } from '@/lib/db'

const COMPANIES  = ['BERLIN_BNK','BYTEWISE','DR.PHARMA','EPPL','EURO TOWERS','GHPL','IIGENTRA','KISCOL','MALEE','MALI CREDIT','MAXITOWER','MERCURY','PDL','PIL','UNIFRESH','USM','WELWYN']
const METHODS    = ['bank','mpesa','cash','cheque','card','rtgs','swift']
const STATUSES   = ['pending','confirmed','failed']
const CURRENCIES = ['KES','USD','EUR','GBP','TZS','UGX']

const STATUS_BADGE: Record<string,string> = { pending:'badge-yellow', confirmed:'badge-green', failed:'badge-red' }
const METHOD_ICON: Record<string,string>  = { bank:'🏦', mpesa:'📱', cash:'💵', cheque:'📝', card:'💳', rtgs:'🏛️', swift:'🌍' }

function fmt(n: number)  { return n.toLocaleString('en-KE', { minimumFractionDigits:2, maximumFractionDigits:2 }) }
function fmtS(n: number) {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `${(n/1_000).toFixed(0)}K`
  return fmt(n)
}

const EMPTY: Partial<Payment> = { company:'', counterpart:'', description:'', amount:0, currency:'KES', payment_date: new Date().toISOString().slice(0,10), method:'bank', reference:'', status:'pending' }

export default function PaymentsClient({ payments: initial, userEmail }: { payments: Payment[]; userEmail: string }) {
  const [payments, setPayments] = useState(initial)
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('')
  const [methodF, setMethodF]   = useState('')
  const [companyF, setCompanyF] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Payment | null>(null)
  const [form, setForm]         = useState<Partial<Payment>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const filtered = useMemo(() => payments.filter(p => {
    if (statusF  && p.status  !== statusF)  return false
    if (methodF  && p.method  !== methodF)  return false
    if (companyF && p.company !== companyF) return false
    if (search) {
      const q = search.toLowerCase()
      return p.counterpart.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q) || p.company.toLowerCase().includes(q)
    }
    return true
  }), [payments, search, statusF, methodF, companyF])

  const stats = useMemo(() => ({
    confirmed: filtered.filter(p => p.status==='confirmed').reduce((a,b) => a+b.amount,0),
    pending:   filtered.filter(p => p.status==='pending').reduce((a,b) => a+b.amount,0),
    total:     filtered.reduce((a,b) => a+b.amount,0),
  }), [filtered])

  const statusCounts = useMemo(() => {
    const c: Record<string,number> = {}
    for (const p of payments) c[p.status] = (c[p.status]||0)+1
    return c
  }, [payments])

  function openNew()              { setForm(EMPTY); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(p: Payment)   { setForm({...p}); setEditing(p); setError(''); setShowForm(true) }
  function set(k: string, v: unknown) { setForm(p => ({...p,[k]:v})) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/payments/${editing.id}` : '/api/payments'
      const res = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setError(data.error||'Failed'); return }
      if (editing) setPayments(p => p.map(x => x.id===editing.id ? data.payment : x))
      else         setPayments(p => [data.payment,...p])
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Delete this payment record?')) return
    const res = await fetch(`/api/payments/${id}`, { method:'DELETE' })
    if (res.ok) setPayments(p => p.filter(x => x.id!==id))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-sub">{payments.length} records across all companies</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Record Payment</button>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Payments', value:`KES ${fmtS(stats.total)}`,     full:fmt(stats.total),     color:'var(--info)',    icon:'💸' },
          { label:'Confirmed',      value:`KES ${fmtS(stats.confirmed)}`, full:fmt(stats.confirmed), color:'var(--primary)', icon:'✅' },
          { label:'Pending',        value:`KES ${fmtS(stats.pending)}`,   full:fmt(stats.pending),   color:'var(--warning)', icon:'⏳' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }} title={`KES ${s.full}`}>
            <span style={{ fontSize:26 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase' }}>{s.label}</div>
              <div style={{ fontSize:18, fontWeight:700, color:s.color, marginTop:2 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Status chips */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {Object.entries(statusCounts).map(([s,n]) => (
          <button key={s} onClick={() => setStatusF(statusF===s?'':s)} style={{
            padding:'4px 12px', borderRadius:999, border:`1px solid ${statusF===s?'var(--primary)':'var(--border)'}`,
            background:statusF===s?'var(--primary-light)':'var(--surface)', cursor:'pointer',
            fontSize:12, fontWeight:600, color:statusF===s?'var(--primary)':'var(--muted)',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span className={`badge ${STATUS_BADGE[s]??'badge-gray'}`} style={{ fontSize:10, padding:'1px 6px' }}>{s}</span>{n}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="filter-input" type="text" placeholder="🔍  Search counterpart, reference, company…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth:240 }} />
        <select className="filter-select" value={methodF} onChange={e => setMethodF(e.target.value)}>
          <option value="">All methods</option>
          {METHODS.map(m => <option key={m} value={m}>{METHOD_ICON[m]} {m}</option>)}
        </select>
        <select className="filter-select" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={companyF} onChange={e => setCompanyF(e.target.value)}>
          <option value="">All companies</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search||methodF||statusF||companyF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setMethodF(''); setStatusF(''); setCompanyF('') }}>✕ Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card table-wrap">
        <table>
          <thead><tr>
            <th>Date</th><th>Company</th><th>Counterpart</th><th>Description</th>
            <th style={{ textAlign:'right' }}>Amount</th><th>Method</th><th>Reference</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{ whiteSpace:'nowrap', fontSize:12, color:'var(--muted)' }}>{p.payment_date}</td>
                <td><span className="co-tag">{p.company}</span></td>
                <td style={{ fontWeight:500 }}>{p.counterpart}</td>
                <td style={{ color:'var(--muted)', maxWidth:180 }}>
                  <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description||'—'}</div>
                </td>
                <td style={{ textAlign:'right', fontWeight:600, whiteSpace:'nowrap' }}>{p.currency} {fmt(p.amount)}</td>
                <td style={{ whiteSpace:'nowrap' }}>{METHOD_ICON[p.method]||''} <span style={{ fontSize:12 }}>{p.method}</span></td>
                <td style={{ fontSize:12, color:'var(--muted)' }}>{p.reference||'—'}</td>
                <td><span className={`badge ${STATUS_BADGE[p.status]??'badge-gray'}`}>{p.status}</span></td>
                <td>
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-xs" style={{ background:'var(--danger-light)', color:'var(--danger)' }} onClick={() => del(p.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={9} className="table-empty">No payments match your filters</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-md">
            <div className="modal-header">
              <span className="modal-title">{editing?'Edit Payment':'Record Payment'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Company *</label>
                  <select className="form-select" value={form.company||''} onChange={e => set('company',e.target.value)}>
                    <option value="">Select company…</option>
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Counterpart *</label>
                  <input className="form-input" value={form.counterpart||''} onChange={e => set('counterpart',e.target.value)} placeholder="Vendor or recipient" />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.amount||0} onChange={e => set('amount',Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={form.currency||'KES'} onChange={e => set('currency',e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Date *</label>
                  <input className="form-input" type="date" value={form.payment_date||''} onChange={e => set('payment_date',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Method *</label>
                  <select className="form-select" value={form.method||'bank'} onChange={e => set('method',e.target.value)}>
                    {METHODS.map(m => <option key={m} value={m}>{METHOD_ICON[m]} {m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Reference No</label>
                  <input className="form-input" value={form.reference||''} onChange={e => set('reference',e.target.value)} placeholder="Transaction / cheque no" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status *</label>
                  <select className="form-select" value={form.status||'pending'} onChange={e => set('status',e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Description</label>
                  <textarea className="form-textarea" value={form.description||''} onChange={e => set('description',e.target.value)} placeholder="What this payment is for…" />
                </div>
              </div>
              {error && <div style={{ color:'var(--danger)', fontSize:13, marginTop:12 }}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving?'Saving…':editing?'Save Changes':'Record Payment'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
