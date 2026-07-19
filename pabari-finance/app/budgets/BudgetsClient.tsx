'use client'

import { useState, useMemo } from 'react'
import type { Budget } from '@/lib/db'

const COMPANIES  = ['BERLIN_BNK','BYTEWISE','DR.PHARMA','EPPL','EURO TOWERS','GHPL','IIGENTRA','KISCOL','MALEE','MALI CREDIT','MAXITOWER','MERCURY','PDL','PIL','UNIFRESH','USM','WELWYN']
const CATEGORIES = ['Salaries & Wages','Rent & Lease','Utilities','Fuel & Transport','Marketing & Advertising','Maintenance & Repairs','Capital Expenditure','Office Supplies','Travel & Accommodation','Insurance','Tax & Compliance','IT & Technology','Professional Fees','Other']
const CURRENCIES = ['KES','USD','EUR','GBP','TZS','UGX']

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits:0, maximumFractionDigits:0 }) }
function fmtS(n: number) {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `${(n/1_000).toFixed(0)}K`
  return fmt(n)
}
function pct(spent: number, budgeted: number) { return budgeted > 0 ? Math.min(100, Math.round((spent/budgeted)*100)) : 0 }

function BarColor(p: number) { return p>=100?'#dc2626':p>=80?'#d97706':'#15803d' }

const EMPTY: Partial<Budget> = { company:'', category:'', period: new Date().toISOString().slice(0,7), budgeted:0, spent:0, currency:'KES', notes:'' }

export default function BudgetsClient({ budgets: initial, userEmail }: { budgets: Budget[]; userEmail: string }) {
  const [budgets, setBudgets]   = useState(initial)
  const [companyF, setCompanyF] = useState('')
  const [periodF, setPeriodF]   = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState<Partial<Budget>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [view, setView]         = useState<'cards'|'table'>('cards')

  const periods = useMemo(() => Array.from(new Set(budgets.map(b => b.period))).sort().reverse(), [budgets])

  const filtered = useMemo(() => budgets.filter(b => {
    if (companyF && b.company !== companyF) return false
    if (periodF  && b.period  !== periodF)  return false
    return true
  }), [budgets, companyF, periodF])

  const totals = useMemo(() => ({
    budgeted: filtered.reduce((a,b) => a+b.budgeted,0),
    spent:    filtered.reduce((a,b) => a+b.spent,0),
  }), [filtered])

  const overBudget = filtered.filter(b => b.spent > b.budgeted)

  function set(k: string, v: unknown) { setForm(p => ({...p,[k]:v})) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const res  = await fetch('/api/budgets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setError(data.error||'Failed'); return }
      setBudgets(prev => {
        const idx = prev.findIndex(b => b.company===data.budget.company && b.category===data.budget.category && b.period===data.budget.period)
        if (idx>=0) { const next=[...prev]; next[idx]=data.budget; return next }
        return [data.budget,...prev]
      })
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  function openEdit(b: Budget) { setForm({...b}); setError(''); setShowForm(true) }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Budget Tracking</h1>
          <p className="page-sub">{filtered.length} budget entries · {pct(totals.spent,totals.budgeted)}% overall utilisation</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
            {(['cards','table'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding:'6px 14px', fontSize:12, fontWeight:600, background:view===v?'var(--primary)':'var(--surface)', color:view===v?'#fff':'var(--muted)', border:'none', cursor:'pointer' }}>
                {v==='cards'?'⊞ Cards':'≡ Table'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setError(''); setShowForm(true) }}>+ Set Budget</button>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { label:'Total Budgeted', value:`KES ${fmtS(totals.budgeted)}`, full:fmt(totals.budgeted), color:'var(--info)', icon:'📋' },
          { label:'Total Spent',    value:`KES ${fmtS(totals.spent)}`,    full:fmt(totals.spent),    color:'var(--primary)', icon:'💰' },
          { label:'Remaining',      value:`KES ${fmtS(Math.max(0,totals.budgeted-totals.spent))}`, full:fmt(Math.max(0,totals.budgeted-totals.spent)), color:'var(--primary)', icon:'✅' },
          { label:'Over Budget',    value:`${overBudget.length} items`,   full:'',                   color: overBudget.length>0?'var(--danger)':'var(--muted)', icon:'⚠️' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }} title={s.full ? `KES ${s.full}`:undefined}>
            <span style={{ fontSize:24 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase' }}>{s.label}</div>
              <div style={{ fontSize:16, fontWeight:700, color:s.color, marginTop:2 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall progress bar */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:600 }}>Overall Budget Utilisation</span>
          <span style={{ fontSize:13, fontWeight:700, color:BarColor(pct(totals.spent,totals.budgeted)) }}>{pct(totals.spent,totals.budgeted)}%</span>
        </div>
        <div className="progress-wrap" style={{ height:12 }}>
          <div className="progress-bar" style={{ width:`${pct(totals.spent,totals.budgeted)}%`, background:BarColor(pct(totals.spent,totals.budgeted)) }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:11, color:'var(--muted)' }}>
          <span>Spent: KES {fmt(totals.spent)}</span>
          <span>Budget: KES {fmt(totals.budgeted)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <select className="filter-select" value={companyF} onChange={e => setCompanyF(e.target.value)} style={{ minWidth:180 }}>
          <option value="">All companies</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="filter-select" value={periodF} onChange={e => setPeriodF(e.target.value)} style={{ minWidth:140 }}>
          <option value="">All periods</option>
          {periods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        {(companyF||periodF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setCompanyF(''); setPeriodF('') }}>✕ Clear</button>
        )}
        <span style={{ fontSize:12, color:'var(--muted)', marginLeft:'auto' }}>{filtered.length} entries</span>
      </div>

      {filtered.length===0 && (
        <div className="card" style={{ padding:60, textAlign:'center', color:'var(--muted)' }}>
          No budget entries yet. Click "Set Budget" to create one.
        </div>
      )}

      {/* Cards view */}
      {view==='cards' && filtered.length>0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
          {filtered.map(b => {
            const p = pct(b.spent,b.budgeted)
            const remaining = b.budgeted - b.spent
            const color = BarColor(p)
            return (
              <div key={b.id} className="card" style={{ padding:20 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:15, marginBottom:3 }}>{b.category}</div>
                    <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                      <span className="co-tag">{b.company}</span>
                      <span style={{ fontSize:11, color:'var(--muted)', background:'var(--border-light)', padding:'1px 6px', borderRadius:4 }}>{b.period}</span>
                    </div>
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={() => openEdit(b)}>Edit</button>
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <div>
                    <div style={{ fontSize:10, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', marginBottom:2 }}>Spent</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>{b.currency} {fmtS(b.spent)}</div>
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <div style={{ fontSize:10, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', marginBottom:2 }}>Budget</div>
                    <div style={{ fontSize:18, fontWeight:700, color:'var(--muted)' }}>{b.currency} {fmtS(b.budgeted)}</div>
                  </div>
                </div>

                <div className="progress-wrap" style={{ marginBottom:8 }}>
                  <div className="progress-bar" style={{ width:`${p}%`, background:color }} />
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:12, fontWeight:700, color }}>
                    {p}% used
                    {p>=100 && <span style={{ marginLeft:6, fontSize:11, background:'var(--danger-light)', color:'var(--danger)', padding:'1px 6px', borderRadius:4, fontWeight:600 }}>OVER BUDGET</span>}
                  </span>
                  <span style={{ fontSize:12, color: remaining<0?'var(--danger)':'var(--muted)', fontWeight: remaining<0?600:400 }}>
                    {remaining<0 ? `Over by ${b.currency} ${fmt(-remaining)}` : `${b.currency} ${fmt(remaining)} left`}
                  </span>
                </div>

                {b.notes && <div style={{ marginTop:10, fontSize:12, color:'var(--muted)', borderTop:'1px solid var(--border-light)', paddingTop:8 }}>{b.notes}</div>}
              </div>
            )
          })}
        </div>
      )}

      {/* Table view */}
      {view==='table' && filtered.length>0 && (
        <div className="card table-wrap">
          <table>
            <thead><tr>
              <th>Company</th><th>Category</th><th>Period</th><th style={{ textAlign:'right' }}>Budget</th>
              <th style={{ textAlign:'right' }}>Spent</th><th style={{ textAlign:'right' }}>Remaining</th>
              <th style={{ width:140 }}>Utilisation</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.map(b => {
                const p = pct(b.spent,b.budgeted)
                const remaining = b.budgeted-b.spent
                return (
                  <tr key={b.id}>
                    <td><span className="co-tag">{b.company}</span></td>
                    <td style={{ fontWeight:500 }}>{b.category}</td>
                    <td style={{ fontSize:12, color:'var(--muted)' }}>{b.period}</td>
                    <td style={{ textAlign:'right', fontWeight:600 }}>{b.currency} {fmt(b.budgeted)}</td>
                    <td style={{ textAlign:'right', fontWeight:600 }}>{b.currency} {fmt(b.spent)}</td>
                    <td style={{ textAlign:'right', fontWeight:600, color:remaining<0?'var(--danger)':'var(--primary)' }}>
                      {remaining<0 ? `-${b.currency} ${fmt(-remaining)}` : `${b.currency} ${fmt(remaining)}`}
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div className="progress-wrap" style={{ flex:1 }}>
                          <div className="progress-bar" style={{ width:`${p}%`, background:BarColor(p) }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color:BarColor(p), width:36, textAlign:'right' }}>{p}%</span>
                      </div>
                    </td>
                    <td><button className="btn btn-ghost btn-xs" onClick={() => openEdit(b)}>Edit</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-md">
            <div className="modal-header">
              <span className="modal-title">Set Budget</span>
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
                  <label className="form-label">Category *</label>
                  <select className="form-select" value={form.category||''} onChange={e => set('category',e.target.value)}>
                    <option value="">Select category…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Period * (e.g. 2026-07 for monthly, 2026-Q3 for quarterly)</label>
                  <input className="form-input" value={form.period||''} onChange={e => set('period',e.target.value)} placeholder="2026-07" />
                </div>
                <div className="form-group">
                  <label className="form-label">Budgeted Amount *</label>
                  <input className="form-input" type="number" min="0" step="100" value={form.budgeted||0} onChange={e => set('budgeted',Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Spent So Far</label>
                  <input className="form-input" type="number" min="0" step="100" value={form.spent||0} onChange={e => set('spent',Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={form.currency||'KES'} onChange={e => set('currency',e.target.value)}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group form-full">
                  <label className="form-label">Notes</label>
                  <textarea className="form-textarea" value={form.notes||''} onChange={e => set('notes',e.target.value)} placeholder="Optional notes…" />
                </div>
              </div>
              {error && <div style={{ color:'var(--danger)', fontSize:13, marginTop:12 }}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving?'Saving…':'Save Budget'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
