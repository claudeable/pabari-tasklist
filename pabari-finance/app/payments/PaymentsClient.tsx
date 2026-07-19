'use client'

import { useState, useMemo } from 'react'
import type { Payment } from '@/lib/db'

const COMPANIES  = ['USM','KISCOL','PABARI GARAGE','PABARI HARDWARE','USM INSURANCE','FARMTRAC','BETA HEALTHCARE','AGRIMED','PABARI INDUSTRIES','PABARI INVESTMENTS','KWALE GROUP','AFRICA HORIZONS','PABARI FOUNDATION','PABARI REAL ESTATE','ILUMET','FARMVET','FARMAGRO']
const METHODS    = ['bank','mpesa','cash','cheque','card']
const STATUSES   = ['pending','confirmed','failed']
const CURRENCIES = ['KES','USD','EUR','GBP']

const STATUS_CLASS: Record<string, string> = {
  pending: 'badge-yellow', confirmed: 'badge-green', failed: 'badge-red',
}

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

const EMPTY: Partial<Payment> = {
  company: '', counterpart: '', description: '', amount: 0, currency: 'KES',
  payment_date: new Date().toISOString().slice(0, 10), method: 'bank', reference: '', status: 'pending',
}

export default function PaymentsClient({ payments: initial }: { payments: Payment[] }) {
  const [payments, setPayments] = useState(initial)
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('')
  const [companyF, setCompanyF] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Payment | null>(null)
  const [form, setForm]         = useState<Partial<Payment>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const filtered = useMemo(() => payments.filter(p => {
    if (statusF  && p.status  !== statusF)  return false
    if (companyF && p.company !== companyF) return false
    if (search) {
      const q = search.toLowerCase()
      return p.counterpart.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.reference.toLowerCase().includes(q)
    }
    return true
  }), [payments, search, statusF, companyF])

  const confirmed = useMemo(() => filtered.filter(p => p.status === 'confirmed').reduce((a, b) => a + b.amount, 0), [filtered])
  const pending   = useMemo(() => filtered.filter(p => p.status === 'pending').reduce((a, b) => a + b.amount, 0), [filtered])

  function openNew() { setForm(EMPTY); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(p: Payment) { setForm({ ...p }); setEditing(p); setError(''); setShowForm(true) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const url    = editing ? `/api/payments/${editing.id}` : '/api/payments'
      const method = editing ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      if (editing) {
        setPayments(prev => prev.map(p => p.id === editing.id ? data.payment : p))
      } else {
        setPayments(prev => [data.payment, ...prev])
      }
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Delete this payment?')) return
    const res = await fetch(`/api/payments/${id}`, { method: 'DELETE' })
    if (res.ok) setPayments(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Payments</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            {filtered.length} records · Confirmed KES {fmt(confirmed)} · Pending KES {fmt(pending)}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Record Payment</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ width: 220 }} />
        <select value={statusF}  onChange={e => setStatusF(e.target.value)}  style={{ width: 140 }}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={companyF} onChange={e => setCompanyF(e.target.value)} style={{ width: 160 }}>
          <option value="">All companies</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search||statusF||companyF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusF(''); setCompanyF('') }}>Clear</button>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              {['Date','Company','Counterpart','Amount','Method','Reference','Status',''].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{p.payment_date}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{p.company}</td>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{p.counterpart}</td>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600 }}>{p.currency} {fmt(p.amount)}</td>
                <td style={{ padding: '10px 14px', fontSize: 12 }}><span className="badge badge-gray">{p.method}</span></td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--muted)' }}>{p.reference || '—'}</td>
                <td style={{ padding: '10px 14px' }}><span className={`badge ${STATUS_CLASS[p.status]??'badge-gray'}`}>{p.status}</span></td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)}>Edit</button>
                    <button className="btn btn-sm" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={() => del(p.id)}>Del</button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>No payments</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
             onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="card" style={{ width: 560, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>{editing ? 'Edit Payment' : 'Record Payment'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Counterpart *', key: 'counterpart', type: 'text' },
                { label: 'Amount *', key: 'amount', type: 'number' },
                { label: 'Payment Date *', key: 'payment_date', type: 'date' },
                { label: 'Reference', key: 'reference', type: 'text' },
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
                { label: 'Company *', key: 'company', opts: COMPANIES },
                { label: 'Method *', key: 'method', opts: METHODS },
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
