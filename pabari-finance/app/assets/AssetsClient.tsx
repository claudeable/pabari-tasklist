'use client'

import { useState, useMemo } from 'react'
import type { Asset } from '@/lib/db'

const COMPANIES  = ['BERLIN_BNK','BYTEWISE','DR.PHARMA','EPPL','EURO TOWERS','GHPL','IIGENTRA','KISCOL','MALEE','MALI CREDIT','MAXITOWER','MERCURY','PDL','PIL','UNIFRESH','USM','WELWYN']
const TYPES      = ['Equipment','Furniture','Vehicle','IT/Electronics','Land','Building','Machinery','Tools','Other']
const STATUSES   = ['active','maintenance','disposed','inactive']
const CURRENCIES = ['KES','USD','EUR','GBP','TZS','UGX']

const STATUS_BADGE: Record<string,string> = { active:'badge-green', maintenance:'badge-yellow', disposed:'badge-red', inactive:'badge-gray' }
const TYPE_ICON:   Record<string,string>  = { Equipment:'⚙️', Furniture:'🪑', Vehicle:'🚗', 'IT/Electronics':'💻', Land:'🌍', Building:'🏢', Machinery:'🔧', Tools:'🔨', Other:'📦' }

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits:0, maximumFractionDigits:0 }) }
function fmtS(n: number) {
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `${(n/1_000).toFixed(0)}K`
  return fmt(n)
}

const TODAY = new Date().toISOString().slice(0,10)

function exportAssetsCSV(assets: Asset[]) {
  const headers = ['Asset No','Name','Type','Company','Location','Department','Assigned To','Serial No','Purchase Date','Currency','Purchase Cost','Current Value','Status','Notes']
  const rows = assets.map(a => [
    a.asset_no, a.name, a.type, a.company, a.location, a.department,
    a.assigned_to, a.serial_no, a.purchase_date??'', a.currency,
    a.purchase_cost, a.current_value, a.status, a.notes,
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `asset-directory-${TODAY}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function exportAssetsPDF(assets: Asset[]) {
  const byCompany: Record<string, Asset[]> = {}
  for (const a of assets) { (byCompany[a.company] ??= []).push(a) }
  const rows = Object.entries(byCompany).map(([co, list]) => `
    <tr style="background:#f0fdf4"><td colspan="8" style="padding:7px 10px;font-weight:700;font-size:12px;color:#14532d;border-bottom:2px solid #16a34a">
      ${co} — ${list.length} asset${list.length!==1?'s':''} &nbsp;|&nbsp; Total value: KES ${list.reduce((s,a)=>s+a.current_value,0).toLocaleString('en-KE',{maximumFractionDigits:0})}
    </td></tr>
    ${list.map(a => `<tr>
      <td style="font-family:monospace;font-size:10px">${a.asset_no}</td>
      <td>${a.name}</td>
      <td>${a.type}</td>
      <td>${a.location||'—'}</td>
      <td>${a.assigned_to||'—'}</td>
      <td style="text-align:right">${a.currency} ${a.current_value.toLocaleString('en-KE',{maximumFractionDigits:0})}</td>
      <td style="text-align:right">${a.currency} ${a.purchase_cost.toLocaleString('en-KE',{maximumFractionDigits:0})}</td>
      <td><span style="padding:2px 6px;border-radius:8px;font-size:10px;font-weight:600;background:${a.status==='active'?'#dcfce7':a.status==='maintenance'?'#fef3c7':'#fee2e2'};color:${a.status==='active'?'#15803d':a.status==='maintenance'?'#92400e':'#991b1b'}">${a.status}</span></td>
    </tr>`).join('')}
  `).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Asset Directory</title>
  <style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}h1{font-size:18px;color:#14532d;margin-bottom:4px}.sub{font-size:11px;color:#6b7280;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#14532d;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle}@media print{body{margin:10px}}</style>
  </head><body>
  <h1>Asset Directory</h1>
  <div class="sub">Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})} | ${assets.length} assets total</div>
  <table><thead><tr><th>Asset No</th><th>Name</th><th>Type</th><th>Location</th><th>Assigned To</th><th style="text-align:right">Current Value</th><th style="text-align:right">Cost</th><th>Status</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <script>window.onload=()=>window.print()</script></body></html>`
  const win = window.open('','_blank'); win?.document.write(html); win?.document.close()
}

const EMPTY: Partial<Asset> = {
  asset_no:'', name:'', type:'Equipment', company:'', location:'', department:'',
  assigned_to:'', purchase_date:TODAY, purchase_cost:0, current_value:0,
  currency:'KES', status:'active', serial_no:'', notes:'',
}

export default function AssetsClient({ assets: initial, userEmail }: { assets: Asset[]; userEmail: string }) {
  const [assets, setAssets]     = useState(initial)
  const [search, setSearch]     = useState('')
  const [typeF, setTypeF]       = useState('')
  const [statusF, setStatusF]   = useState('')
  const [companyF, setCompanyF] = useState('')
  const [view, setView]         = useState<'table'|'grid'>('table')
  const [collapsed, setCollapsed] = useState<Record<string,boolean>>({})
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Asset | null>(null)
  const [form, setForm]         = useState<Partial<Asset>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [detail, setDetail]     = useState<Asset | null>(null)
  const [logs, setLogs]         = useState<{ id:number; date:string; description:string; cost:number; currency:string; provider:string; next_service:string|null }[]>([])
  const [logForm, setLogForm]   = useState({ date:TODAY, description:'', cost:0, currency:'KES', provider:'', next_service:'' })
  const [showLogForm, setShowLogForm] = useState(false)
  const [savingLog, setSavingLog]     = useState(false)

  const filtered = useMemo(() => assets.filter(a => {
    if (typeF    && a.type    !== typeF)    return false
    if (statusF  && a.status  !== statusF)  return false
    if (companyF && a.company !== companyF) return false
    if (search) {
      const q = search.toLowerCase()
      return a.name.toLowerCase().includes(q) || a.asset_no.toLowerCase().includes(q) ||
             a.company.toLowerCase().includes(q) || a.assigned_to.toLowerCase().includes(q) ||
             a.serial_no.toLowerCase().includes(q)
    }
    return true
  }), [assets, search, typeF, statusF, companyF])

  const stats = useMemo(() => ({
    total:      assets.length,
    active:     assets.filter(a => a.status==='active').length,
    totalValue: assets.reduce((s,a) => s+a.current_value, 0),
    cost:       assets.reduce((s,a) => s+a.purchase_cost, 0),
  }), [assets])

  const byCompany = useMemo(() => {
    const map: Record<string, Asset[]> = {}
    for (const a of filtered) { (map[a.company] ??= []).push(a) }
    return map
  }, [filtered])

  function toggleCollapse(co: string) { setCollapsed(c => ({...c,[co]:!c[co]})) }
  function openNew()            { setForm({...EMPTY}); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(a: Asset)   { setForm({...a}); setEditing(a); setError(''); setShowForm(true) }
  function set(k: string, v: unknown) { setForm(p => ({...p,[k]:v})) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/assets/${editing.id}` : '/api/assets'
      const res = await fetch(url, { method:editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setError(data.error||'Failed'); return }
      if (editing) setAssets(a => a.map(x => x.id===editing.id ? data.asset : x))
      else         setAssets(a => [data.asset,...a])
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Delete this asset?')) return
    const res = await fetch(`/api/assets/${id}`, { method:'DELETE' })
    if (res.ok) setAssets(a => a.filter(x => x.id!==id))
  }

  async function openDetail(a: Asset) {
    setDetail(a)
    const res = await fetch(`/api/maintenance?asset_id=${a.id}`)
    if (res.ok) { const d = await res.json(); setLogs(d.logs) }
  }

  async function saveLog() {
    if (!detail) return
    setSavingLog(true)
    try {
      const res = await fetch('/api/maintenance', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...logForm, asset_id: detail.id, cost: Number(logForm.cost) }),
      })
      const data = await res.json()
      if (res.ok) {
        setLogs(l => [data.log,...l])
        setLogForm({ date:TODAY, description:'', cost:0, currency:'KES', provider:'', next_service:'' })
        setShowLogForm(false)
      }
    } finally { setSavingLog(false) }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assets Registry</h1>
          <p className="page-sub">{assets.length} assets across all companies</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className={`btn ${view==='table'?'btn-secondary':'btn-ghost'}`} onClick={() => setView('table')}>☰ Table</button>
          <button className={`btn ${view==='grid' ?'btn-secondary':'btn-ghost'}`} onClick={() => setView('grid')}>⊞ Grid</button>
          <button className="btn btn-secondary" onClick={() => exportAssetsCSV(filtered)} title="Download Excel/CSV">📥 Excel</button>
          <button className="btn btn-secondary" onClick={() => exportAssetsPDF(filtered)} title="Print / Save PDF">🖨️ PDF</button>
          <button className="btn btn-primary" onClick={openNew}>+ Add Asset</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { icon:'🏗️',  label:'Total Assets',   value:String(stats.total),                  color:'var(--info)' },
          { icon:'✅',  label:'Active',          value:String(stats.active),                 color:'var(--primary)' },
          { icon:'💰',  label:'Book Value',      value:`KES ${fmtS(stats.totalValue)}`,      color:'var(--success)' },
          { icon:'📦',  label:'Total Cost',      value:`KES ${fmtS(stats.cost)}`,            color:'var(--muted)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:26 }}>{s.icon}</span>
            <div>
              <div style={{ fontSize:11, color:'var(--muted)', fontWeight:600, textTransform:'uppercase' }}>{s.label}</div>
              <div style={{ fontSize:18, fontWeight:700, color:s.color, marginTop:2 }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input className="filter-input" type="text" placeholder="🔍  Search name, asset no, serial, company…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth:240 }} />
        <select className="filter-select" value={typeF}    onChange={e => setTypeF(e.target.value)}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]||''} {t}</option>)}
        </select>
        <select className="filter-select" value={statusF}  onChange={e => setStatusF(e.target.value)}>
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

      {/* Table view — grouped by company */}
      {view==='table' && (
        Object.keys(byCompany).length === 0 ? (
          <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>No assets match your filters</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {Object.entries(byCompany).map(([co, list]) => {
              const isCollapsed = collapsed[co]
              const coValue = list.reduce((s,a) => s+a.current_value, 0)
              return (
                <div key={co} className="card" style={{ overflow:'hidden' }}>
                  <div
                    onClick={() => toggleCollapse(co)}
                    style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'var(--primary-light)', borderBottom:isCollapsed?'none':'1px solid var(--border)', cursor:'pointer', userSelect:'none' }}
                  >
                    <span style={{ fontSize:13, fontWeight:700, color:'var(--primary)', flex:1 }}>{co}</span>
                    <span style={{ fontSize:12, color:'var(--muted)' }}>{list.length} asset{list.length!==1?'s':''}</span>
                    <span style={{ fontSize:12, color:'var(--primary)', fontWeight:600 }}>KES {fmt(coValue)}</span>
                    <span style={{ fontSize:12, color:'var(--muted)' }}>{isCollapsed ? '▶' : '▼'}</span>
                  </div>
                  {!isCollapsed && (
                    <div style={{ overflowX:'auto' }}>
                      <table>
                        <thead><tr>
                          <th>Asset No</th><th>Name</th><th>Type</th>
                          <th>Location</th><th>Assigned To</th>
                          <th style={{ textAlign:'right' }}>Current Value</th>
                          <th>Status</th><th></th>
                        </tr></thead>
                        <tbody>
                          {list.map(a => (
                            <tr key={a.id} style={{ cursor:'pointer' }} onClick={() => openDetail(a)}>
                              <td style={{ fontFamily:'monospace', fontSize:12, color:'var(--muted)' }}>{a.asset_no}</td>
                              <td style={{ fontWeight:600 }}>{a.name}</td>
                              <td style={{ whiteSpace:'nowrap' }}>{TYPE_ICON[a.type]||''} <span style={{ fontSize:12 }}>{a.type}</span></td>
                              <td style={{ fontSize:12, color:'var(--muted)' }}>{a.location||'—'}</td>
                              <td style={{ fontSize:12 }}>{a.assigned_to||'—'}</td>
                              <td style={{ textAlign:'right', fontWeight:600 }}>{a.currency} {fmt(a.current_value)}</td>
                              <td><span className={`badge ${STATUS_BADGE[a.status]??'badge-gray'}`}>{a.status}</span></td>
                              <td onClick={e => e.stopPropagation()}>
                                <div style={{ display:'flex', gap:4 }}>
                                  <button className="btn btn-ghost btn-xs" onClick={() => openEdit(a)}>Edit</button>
                                  <button className="btn btn-xs" style={{ background:'var(--danger-light)', color:'var(--danger)' }} onClick={() => del(a.id)}>Del</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Grid view */}
      {view==='grid' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
          {filtered.map(a => (
            <div key={a.id} className="card" style={{ padding:20, cursor:'pointer' }} onClick={() => openDetail(a)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <span style={{ fontSize:28 }}>{TYPE_ICON[a.type]||'📦'}</span>
                </div>
                <span className={`badge ${STATUS_BADGE[a.status]??'badge-gray'}`}>{a.status}</span>
              </div>
              <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>{a.name}</div>
              <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace', marginBottom:8 }}>{a.asset_no}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, fontSize:12, color:'var(--muted)' }}>
                <div><span className="co-tag">{a.company}</span></div>
                {a.location && <div>📍 {a.location}</div>}
                {a.assigned_to && <div>👤 {a.assigned_to}</div>}
              </div>
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', fontWeight:600 }}>Current Value</div>
                  <div style={{ fontWeight:700, color:'var(--primary)' }}>{a.currency} {fmtS(a.current_value)}</div>
                </div>
                <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-ghost btn-xs" onClick={() => openEdit(a)}>Edit</button>
                  <button className="btn btn-xs" style={{ background:'var(--danger-light)', color:'var(--danger)' }} onClick={() => del(a.id)}>Del</button>
                </div>
              </div>
            </div>
          ))}
          {filtered.length===0 && (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:60, color:'var(--muted)' }}>
              No assets match your filters
            </div>
          )}
        </div>
      )}

      {/* Detail side panel */}
      {detail && (
        <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) setDetail(null) }}>
          <div className="modal" style={{ maxWidth:540, height:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">{detail.name}</span>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:2, fontFamily:'monospace' }}>{detail.asset_no}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex:1, overflowY:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                {[
                  ['Type',           detail.type],
                  ['Company',        detail.company],
                  ['Status',         detail.status],
                  ['Location',       detail.location||'—'],
                  ['Department',     detail.department||'—'],
                  ['Assigned To',    detail.assigned_to||'—'],
                  ['Serial No',      detail.serial_no||'—'],
                  ['Purchase Date',  detail.purchase_date||'—'],
                  ['Purchase Cost',  `${detail.currency} ${fmt(detail.purchase_cost)}`],
                  ['Current Value',  `${detail.currency} ${fmt(detail.current_value)}`],
                ].map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', fontWeight:600, marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {detail.notes && (
                <div style={{ padding:'10px 14px', background:'var(--bg)', borderRadius:8, fontSize:13, color:'var(--muted)', marginBottom:20 }}>{detail.notes}</div>
              )}

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Maintenance Log</h3>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowLogForm(s => !s)}>+ Log Service</button>
              </div>

              {showLogForm && (
                <div className="card" style={{ padding:16, marginBottom:14 }}>
                  <div className="form-grid" style={{ gridTemplateColumns:'1fr 1fr' }}>
                    <div className="form-group">
                      <label className="form-label">Date *</label>
                      <input className="form-input" type="date" value={logForm.date} onChange={e => setLogForm(f => ({...f,date:e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cost</label>
                      <input className="form-input" type="number" min="0" step="0.01" value={logForm.cost} onChange={e => setLogForm(f => ({...f,cost:+e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Currency</label>
                      <select className="form-select" value={logForm.currency} onChange={e => setLogForm(f => ({...f,currency:e.target.value}))}>
                        {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Provider</label>
                      <input className="form-input" value={logForm.provider} onChange={e => setLogForm(f => ({...f,provider:e.target.value}))} placeholder="Service provider" />
                    </div>
                    <div className="form-group" style={{ gridColumn:'1/-1' }}>
                      <label className="form-label">Description *</label>
                      <textarea className="form-textarea" style={{ minHeight:60 }} value={logForm.description} onChange={e => setLogForm(f => ({...f,description:e.target.value}))} placeholder="Work done…" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Next Service Date</label>
                      <input className="form-input" type="date" value={logForm.next_service} onChange={e => setLogForm(f => ({...f,next_service:e.target.value}))} />
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setShowLogForm(false)}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={saveLog} disabled={savingLog}>{savingLog?'Saving…':'Save Log'}</button>
                  </div>
                </div>
              )}

              {logs.length===0 ? (
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted)', fontSize:13 }}>No maintenance records yet</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {logs.map(l => (
                    <div key={l.id} style={{ padding:'12px 14px', border:'1px solid var(--border)', borderRadius:8 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:'var(--muted)' }}>{l.date}</span>
                        {l.cost > 0 && <span style={{ fontSize:12, fontWeight:700, color:'var(--primary)' }}>{l.currency} {fmt(l.cost)}</span>}
                      </div>
                      <div style={{ fontSize:13, fontWeight:500, marginBottom:2 }}>{l.description}</div>
                      {l.provider && <div style={{ fontSize:11, color:'var(--muted)' }}>By: {l.provider}</div>}
                      {l.next_service && <div style={{ fontSize:11, color:'var(--warning)', marginTop:4 }}>Next service: {l.next_service}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => { openEdit(detail); setDetail(null) }}>Edit Asset</button>
              <button className="btn btn-ghost" onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {showForm && (
        <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) setShowForm(false) }}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <span className="modal-title">{editing?'Edit Asset':'Add Asset'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Asset No *</label>
                  <input className="form-input" value={form.asset_no||''} onChange={e => set('asset_no',e.target.value)} placeholder="e.g. USM-EQ-001" />
                </div>
                <div className="form-group">
                  <label className="form-label">Name *</label>
                  <input className="form-input" value={form.name||''} onChange={e => set('name',e.target.value)} placeholder="Asset name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Type *</label>
                  <select className="form-select" value={form.type||'Equipment'} onChange={e => set('type',e.target.value)}>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_ICON[t]||''} {t}</option>)}
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
                  <label className="form-label">Location</label>
                  <input className="form-input" value={form.location||''} onChange={e => set('location',e.target.value)} placeholder="e.g. Mombasa Office" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <input className="form-input" value={form.department||''} onChange={e => set('department',e.target.value)} placeholder="e.g. Operations" />
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned To</label>
                  <input className="form-input" value={form.assigned_to||''} onChange={e => set('assigned_to',e.target.value)} placeholder="Employee name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Serial No</label>
                  <input className="form-input" value={form.serial_no||''} onChange={e => set('serial_no',e.target.value)} placeholder="Manufacturer serial" />
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Date</label>
                  <input className="form-input" type="date" value={form.purchase_date||''} onChange={e => set('purchase_date',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Currency</label>
                  <select className="form-select" value={form.currency||'KES'} onChange={e => set('currency',e.target.value)}>
                    {CURRENCIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Purchase Cost</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.purchase_cost||0} onChange={e => set('purchase_cost',Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Value</label>
                  <input className="form-input" type="number" min="0" step="0.01" value={form.current_value||0} onChange={e => set('current_value',Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status||'active'} onChange={e => set('status',e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
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
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving?'Saving…':editing?'Save Changes':'Add Asset'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
