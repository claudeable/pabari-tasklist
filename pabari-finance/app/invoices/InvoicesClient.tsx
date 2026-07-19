'use client'

import { useState, useMemo } from 'react'
import type { Invoice } from '@/lib/db'

const COMPANIES = ['USM','KISCOL','PABARI GARAGE','PABARI HARDWARE','USM INSURANCE','FARMTRAC','BETA HEALTHCARE','AGRIMED','PABARI INDUSTRIES','PABARI INVESTMENTS','KWALE GROUP','AFRICA HORIZONS','PABARI FOUNDATION','PABARI REAL ESTATE','ILUMET','FARMVET','FARMAGRO']
const TYPES     = ['invoice','bill','receipt','lpo']
const STATUSES  = ['draft','sent','approved','paid','overdue','cancelled']
const CURRENCIES = ['KES','USD','EUR','GBP']

const STATUS_CLASS: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', approved: 'badge-yellow',
  paid: 'badge-green', overdue: 'badge-red', cancelled: 'badge-gray',
}

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const EMPTY: Partial<Invoice> = {
  ref_no: '', type: 'invoice', company: '', counterpart: '', description: '',
  amount: 0, currency: 'KES', issue_date: new Date().toISOString().slice(0, 10),
  due_date: '', status: 'draft', notes: '',
}

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
      return inv.ref_no.toLowerCase().includes(q) || inv.counterpart.toLowerCase().includes(q) || inv.description.toLowerCase().includes(q)
    }
    return true
  }), [invoices, search, statusF, typeF, companyF])

  const totals = useMemo(() => ({
    total: filtered.reduce((a, b) => a + b.amount, 0),
    paid:  filtered.filter(i => i.status === 'paid').reduce((a, b) => a + b.amount, 0),
  }), [filtered])

  function openNew() { setForm(EMPTY); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(inv: Invoice) { setForm({ ...inv }); setEditing(inv); setError(''); setShowForm(true) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const url    = editing ? `/api/invoices/${editing.id}` : '/api/invoices'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      if (editing) {
        setInvoices(prev => prev.map(i => i.id === editing.id ? data.invoice : i))
      } else {
        setInvoices(prev => [data.invoice, ...prev])
      }
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function deleteInv(id: number) {
    if (!confirm('Delete this invoice?')) return
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) setInvoices(prev => prev.filter(i => i.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Invoices & Documents</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            {filtered.length} records · Total KES {fmt(totals.total)} · Paid KES {fmt(totals.paid)}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ New Invoice</button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        <select value={typeF}    onChange={e => setTypeF(e.target.value)}    style={{ width: 130 }}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusF}  onChange={e => setStatusF(e.target.value)}  style={{ width: 140 }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={companyF} onChange={e => setCompanyF(e.target.value)} style={{ width: 160 }}>
          <option value="">All companies</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search||typeF||statusF||companyF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setTypeF(''); setStatusF(''); setCompanyF('') }}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Ref No','Type','Company','Counterpart','Amount','Status','Issue Date','Due Date',''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => (
              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{inv.ref_no}</td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}><span className="badge badge-gray">{inv.type}</span></td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{inv.company}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{inv.counterpart}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{inv.currency} {fmt(inv.amount)}</td>
                <td style={{ padding: '10px 14px' }}><span className={`badge ${STATUS_CLASS[inv.status]??'badge-gray'}`}>{inv.status}</span></td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)' }}>{inv.issue_date}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: inv.status==='overdue'?'#dc2626':'var(--muted)' }}>{inv.due_date || '—'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(inv)}>Edit</button>
                    <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={() => deleteInv(inv.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No invoices</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
             onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="card" style={{ width: 600, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>{editing ? 'Edit Invoice' : 'New Invoice'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Ref No *', key: 'ref_no', type: 'text' },
                { label: 'Counterpart / Vendor *', key: 'counterpart', type: 'text' },
                { label: 'Amount *', key: 'amount', type: 'number' },
                { label: 'Issue Date *', key: 'issue_date', type: 'date' },
                { label: 'Due Date', key: 'due_date', type: 'date' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={String((form as Record<string, unknown>)[f.key] ?? '')}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  />
                </div>
              ))}

              {[
                { label: 'Type *', key: 'type', opts: TYPES },
                { label: 'Company *', key: 'company', opts: COMPANIES },
                { label: 'Currency', key: 'currency', opts: CURRENCIES },
                { label: 'Status *', key: 'status', opts: STATUSES },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                  <select value={String((form as Record<string, unknown>)[f.key] ?? '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">Select…</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase' }}>Description</label>
              <textarea rows={2} value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase' }}>Notes</label>
              <textarea rows={2} value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
            </div>

            {error && <div style={{ color: '#dc2626', fontSize: 13, marginTop: 12 }}>{error}</div>}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
