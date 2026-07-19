'use client'

import { useState, useMemo } from 'react'
import type { Budget } from '@/lib/db'

const COMPANIES  = ['USM','KISCOL','PABARI GARAGE','PABARI HARDWARE','USM INSURANCE','FARMTRAC','BETA HEALTHCARE','AGRIMED','PABARI INDUSTRIES','PABARI INVESTMENTS','KWALE GROUP','AFRICA HORIZONS','PABARI FOUNDATION','PABARI REAL ESTATE','ILUMET','FARMVET','FARMAGRO']
const CATEGORIES = ['Salaries','Rent','Utilities','Fuel','Marketing','Maintenance','Capex','Supplies','Travel','Insurance','Tax','Other']
const CURRENCIES = ['KES','USD','EUR','GBP']

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }
function pct(spent: number, budgeted: number) { return budgeted > 0 ? Math.min(100, Math.round((spent / budgeted) * 100)) : 0 }

function ProgressBar({ value, max }: { value: number; max: number }) {
  const p = pct(value, max)
  const color = p >= 100 ? '#dc2626' : p >= 80 ? '#d97706' : '#15803d'
  return (
    <div style={{ background: '#e2e8f0', borderRadius: 4, height: 8, overflow: 'hidden' }}>
      <div style={{ width: `${p}%`, background: color, height: '100%', borderRadius: 4, transition: 'width .3s' }} />
    </div>
  )
}

const EMPTY: Partial<Budget> = {
  company: '', category: '', period: new Date().toISOString().slice(0, 7).replace('-', '-'),
  budgeted: 0, spent: 0, currency: 'KES', notes: '',
}

export default function BudgetsClient({ budgets: initial }: { budgets: Budget[] }) {
  const [budgets, setBudgets] = useState(initial)
  const [companyF, setCompanyF] = useState('')
  const [periodF, setPeriodF]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Budget | null>(null)
  const [form, setForm]         = useState<Partial<Budget>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const periods = useMemo(() => Array.from(new Set(budgets.map(b => b.period))).sort().reverse(), [budgets])

  const filtered = useMemo(() => budgets.filter(b => {
    if (companyF && b.company !== companyF) return false
    if (periodF  && b.period  !== periodF)  return false
    return true
  }), [budgets, companyF, periodF])

  const totals = useMemo(() => ({
    budgeted: filtered.reduce((a, b) => a + b.budgeted, 0),
    spent:    filtered.reduce((a, b) => a + b.spent, 0),
  }), [filtered])

  function openNew()  { setForm(EMPTY); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(b: Budget) { setForm({ ...b }); setEditing(b); setError(''); setShowForm(true) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const res  = await fetch('/api/budgets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed'); return }
      setBudgets(prev => {
        const idx = prev.findIndex(b => b.company === data.budget.company && b.category === data.budget.category && b.period === data.budget.period)
        if (idx >= 0) { const next = [...prev]; next[idx] = data.budget; return next }
        return [data.budget, ...prev]
      })
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Budget Tracking</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>
            {filtered.length} entries · Budgeted KES {fmt(totals.budgeted)} · Spent KES {fmt(totals.spent)} · {pct(totals.spent, totals.budgeted)}% utilised
          </p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Set Budget</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={companyF} onChange={e => setCompanyF(e.target.value)} style={{ width: 180 }}>
          <option value="">All companies</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={periodF} onChange={e => setPeriodF(e.target.value)} style={{ width: 140 }}>
          <option value="">All periods</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(companyF||periodF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setCompanyF(''); setPeriodF('') }}>Clear</button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(b => {
          const p = pct(b.spent, b.budgeted)
          const remaining = b.budgeted - b.spent
          return (
            <div key={b.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{b.category}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{b.company} · {b.period}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{b.currency} {fmt(b.spent)} <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 13 }}>/ {fmt(b.budgeted)}</span></div>
                  <div style={{ fontSize: 12, color: remaining < 0 ? '#dc2626' : 'var(--muted)', marginTop: 2 }}>
                    {remaining < 0 ? `Over by ${fmt(-remaining)}` : `${fmt(remaining)} remaining`}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => openEdit(b)} style={{ marginLeft: 16 }}>Edit</button>
              </div>
              <ProgressBar value={b.spent} max={b.budgeted} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6, fontSize: 12, color: p >= 100 ? '#dc2626' : p >= 80 ? '#d97706' : '#15803d', fontWeight: 600 }}>
                {p}% utilised
              </div>
              {b.notes && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{b.notes}</div>}
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="card" style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>
            No budget entries. Click "Set Budget" to create one.
          </div>
        )}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
             onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div className="card" style={{ width: 520, padding: 28 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>Set Budget</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Company *', key: 'company', opts: COMPANIES },
                { label: 'Category *', key: 'category', opts: CATEGORIES },
                { label: 'Currency', key: 'currency', opts: CURRENCIES },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                  <select value={String((form as Record<string, unknown>)[f.key] ?? '')} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                    <option value="">Select…</option>
                    {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}

              {[
                { label: 'Period * (e.g. 2026-07 or 2026-Q3)', key: 'period', type: 'text' },
                { label: 'Budgeted Amount *', key: 'budgeted', type: 'number' },
                { label: 'Spent So Far', key: 'spent', type: 'number' },
              ].map(f => (
                <div key={f.key} style={f.key === 'period' ? { gridColumn: '1 / -1' } : {}}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, textTransform: 'uppercase' }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={String((form as Record<string, unknown>)[f.key] ?? '')}
                    onChange={e => setForm(p => ({ ...p, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))}
                  />
                </div>
              ))}
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
