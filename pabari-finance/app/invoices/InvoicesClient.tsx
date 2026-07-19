'use client'

import { useState, useMemo } from 'react'
import type { Invoice } from '@/lib/db'

const COMPANIES  = ['USM','KISCOL','PABARI GARAGE','PABARI HARDWARE','USM INSURANCE','FARMTRAC','BETA HEALTHCARE','AGRIMED','PABARI INDUSTRIES','PABARI INVESTMENTS','KWALE GROUP','AFRICA HORIZONS','PABARI FOUNDATION','PABARI REAL ESTATE','ILUMET','FARMVET','FARMAGRO']
const TYPES      = ['invoice','bill','receipt','lpo','credit-note','debit-note']
const STATUSES   = ['draft','sent','approved','paid','overdue','cancelled']
const CURRENCIES = ['KES','USD','EUR','GBP','TZS','UGX']

const STATUS_BADGE: Record<string,string> = {
  draft:'badge-gray', sent:'badge-blue', approved:'badge-purple',
  paid:'badge-green', overdue:'badge-red', cancelled:'badge-gray',
}
const TYPE_ICON: Record<string,string> = {
  invoice:'🧾', bill:'📋', receipt:'✅', lpo:'📦', 'credit-note':'↩️', 'debit-note':'↪️',
}

function fmt(n: number)  { return n.toLocaleString('en-KE', { minimumFractionDigits:2, maximumFractionDigits:2 }) }
function fmtS(n: number) {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `${(n/1_000).toFixed(0)}K`
  return fmt(n)
}

const EMPTY: Partial<Invoice> = { ref_no:'', type:'invoice', company:'', counterpart:'', description:'', amount:0, currency:'KES', issue_date: new Date().toISOString().slice(0,10), due_date:'', status:'draft', notes:'' }

export default function InvoicesClient({ invoices: initial, userEmail }: { invoices: Invoice[]; userEmail: string }) {
  const [invoices, setInvoices] = useState(initial)
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('')
  const [typeF, setTypeF]       = useState('')
  const [companyF, setCompanyF] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Invoice | null>(null)
  const [form, setForm]         = useState<Partial<Invoice>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const filtered = useMemo(() => invoices.filter(inv => {
    if (statusF  && inv.status  !== statusF)  return false
    if (typeF    && inv.type    !== typeF)    return false
    if (companyF && inv.company !== companyF) return false
    if (search) {
      const q = search.toLowerCase()
      return inv.ref_no.toLowerCase().includes(q) || inv.counterpart.toLowerCase().includes(q) || inv.company.toLowerCase().includes(q) || inv.description.toLowerCase().includes(q)
    }
    return true
  }), [invoices, search, statusF, typeF, companyF])

  const stats = useMemo(() => ({
    total:   filtered.reduce((a,b) => a+b.amount, 0),
    paid:    filtered.filter(i => i.status==='paid').reduce((a,b) => a+b.amount, 0),
    overdue: filtered.filter(i => i.status==='overdue').reduce((a,b) => a+b.amount, 0),
  }), [filtered])

  const statusCounts = useMemo(() => {
    const c: Record<string,number> = {}
    for (const inv of invoices) c[inv.status] = (c[inv.status]||0)+1
    return c
  }, [invoices])

  function openNew()            { setForm(EMPTY); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(inv: Invoice) { setForm({...inv}); setEditing(inv); setError(''); setShowForm(true) }
  function set(k: string, v: unknown) { setForm(p => ({...p,[k]:v})) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/invoices/${editing.id}` : '/api/invoices'
      const res = await fetch(url, { method: editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setError(data.error||'Failed'); return }
      if (editing) setInvoices(p => p.map(i => i.id===editing.id ? data.invoice : i))
      else         setInvoices(p => [data.invoice,...p])
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Delete this invoice?')) return
    const res = await fetch(`/api/invoices/${id}`, { method:'DELETE' })
    if (res.ok) setInvoices(p => p.filter(i => i.id!==id))
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Invoices & Documents</h1>
          <p className="page-sub">{invoices.length} records across all companies</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ New Document</button>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Value', value:`KES ${fmtS(stats.total)}`, full:fmt(stats.total), color:'var(--info)', icon:'🧾' },
          { label:'Paid', value:`KES ${fmtS(stats.paid)}`, full:fmt(stats.paid), color:'var(--primary)', icon:'✅' },
          { label:'Overdue', value:`KES ${fmtS(stats.overdue)}`, full:fmt(stats.overdue), color:'var(--danger)', icon:'⚠️' },
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
        <input className="filter-input" type="text" placeholder="🔍  Search ref, counterpart, company…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth:240 }} />
        <select className="filter-select" value={typeF} onChange={e => setTypeF(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
        </select>
        <select className="filter-select" value={statusF} onChange={e => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={companyF} onChange={e => setCompanyF(e.target.value)}>
          <option value="">All companies</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search||typeF||statusF||companyF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setTypeF(''); setStatusF(''); setCompanyF('') }}>✕ Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card table-wrap">
        <table>
          <thead><tr>
            <th>Ref No</th><th>Type</th><th>Company</th><th>Counterpart</th>
            <th>Description</th><th style={{ textAlign:'right' }}>Amount</th>
            <th>Status</th><th>Issue Date</th><th>Due Date</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id}>
                <td style={{ fontWeight:600 }}>{inv.ref_no}</td>
                <td>{TYPE_ICON[inv.type]||''} <span style={{ fontSize:12 }}>{inv.type}</span></td>
                <td><span className="co-tag">{inv.company}</span></td>
                <td>{inv.counterpart}</td>
                <td style={{ color:'var(--muted)', maxWidth:180 }}>
                  <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inv.description||'—'}</div>
                </td>
                <td style={{ textAlign:'right', fontWeight:600, whiteSpace:'nowrap' }}>{inv.currency} {fmt(inv.amount)}</td>
                <td><span className={`badge ${STATUS_BADGE[inv.status]??'badge-gray'}`}>{inv.status}</span></td>
                <td style={{ fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{inv.issue_date}</td>
                <td style={{ fontSize:12, whiteSpace:'nowrap', color:inv.status==='overdue'?'var(--danger)':'var(--muted)', fontWeight:inv.status==='overdue'?600:400 }}>{inv.due_date||'—'}</td>
                <td>
                  <div style={{ display:'flex', gap:4 }}>
                    <button className="btn btn-ghost btn-xs" onClick={() => openEdit(inv)}>Edit</button>
                    <button className="btn btn-xs" style={{ background:'var(--danger-light)', color:'var(--danger)' }} onClick={() => del(inv.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length===0 && <tr><td colSpan={10} className="table-empty">No documents match your filters</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">{editing?'Edit Document':'New Document'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Ref No *</label>
                  <input className="form-input" value={form.ref_no||''} onChange={e => set('ref_no',e.target.value)} placeholder="e.g. INV-2026-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Counterpart / Vendor *</label>
                  <input className="form-input" value={form.counterpart||''} onChange={e => set('counterpart',e.target.value)} placeholder="Vendor or client name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select className="form-select" value={form.type||'invoice'} onChange={e => set('type',e.target.value)}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]} {t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Company *</label>
                  <select className="form-select" value={form.company||''} onChange={e => set('company',e.target.value)}>
                    <option value="">Select company…</option>
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
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
                  <label className="form-label">Issue Date *</label>
                  <input className="form-input" type="date" value={form.issue_date||''} onChange={e => set('issue_date',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-input" type="date" value={form.due_date||''} onChange={e => set('due_date',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status *</label>
                  <select className="form-select" value={form.status||'draft'} onChange={e => set('status',e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Description</label>
                  <input className="form-input" value={form.description||''} onChange={e => set('description',e.target.value)} placeholder="Brief description of goods/services" />
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes||''} onChange={e => set('notes',e.target.value)} placeholder="Additional notes…" />
                </div>
              </div>
              {error && <div style={{ color:'var(--danger)', fontSize:13, marginTop:12 }}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving?'Saving…':editing?'Save Changes':'Create Document'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
