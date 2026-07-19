'use client'

import { useState, useMemo } from 'react'
import type { Vehicle } from '@/lib/db'

const COMPANIES  = ['BERLIN_BNK','BYTEWISE','DR.PHARMA','EPPL','EURO TOWERS','GHPL','IIGENTRA','KISCOL','MALEE','MALI CREDIT','MAXITOWER','MERCURY','PDL','PIL','UNIFRESH','USM','WELWYN']
const FUEL_TYPES = ['Petrol','Diesel','Electric','Hybrid','LPG']
const STATUSES   = ['active','maintenance','grounded','sold']
const CURRENCIES = ['KES','USD','EUR','GBP','TZS','UGX']

const STATUS_BADGE: Record<string,string> = { active:'badge-green', maintenance:'badge-yellow', grounded:'badge-red', sold:'badge-gray' }

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits:0, maximumFractionDigits:0 }) }

function isExpiringSoon(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr); const now = new Date()
  return (d.getTime() - now.getTime()) / (1000*60*60*24) <= 30
}

const TODAY = new Date().toISOString().slice(0,10)
const EMPTY: Partial<Vehicle> = {
  reg_plate:'', make:'', model:'', year: new Date().getFullYear(),
  company:'', assigned_driver:'', fuel_type:'Diesel', mileage:0,
  insurance_expiry:'', service_due_date:'', service_due_km:0,
  status:'active', notes:'',
}

export default function VehiclesClient({ vehicles: initial, userEmail }: { vehicles: Vehicle[]; userEmail: string }) {
  const [vehicles, setVehicles] = useState(initial)
  const [search, setSearch]     = useState('')
  const [statusF, setStatusF]   = useState('')
  const [companyF, setCompanyF] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<Vehicle | null>(null)
  const [form, setForm]         = useState<Partial<Vehicle>>(EMPTY)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')
  const [detail, setDetail]     = useState<Vehicle | null>(null)
  const [logs, setLogs]         = useState<{ id:number; date:string; description:string; cost:number; currency:string; provider:string; next_service:string|null }[]>([])
  const [logForm, setLogForm]   = useState({ date:TODAY, description:'', cost:0, currency:'KES', provider:'', next_service:'' })
  const [showLogForm, setShowLogForm] = useState(false)
  const [savingLog, setSavingLog]     = useState(false)

  const filtered = useMemo(() => vehicles.filter(v => {
    if (statusF  && v.status  !== statusF)  return false
    if (companyF && v.company !== companyF) return false
    if (search) {
      const q = search.toLowerCase()
      return v.reg_plate.toLowerCase().includes(q) || v.make.toLowerCase().includes(q) ||
             v.model.toLowerCase().includes(q) || v.company.toLowerCase().includes(q) ||
             v.assigned_driver.toLowerCase().includes(q)
    }
    return true
  }), [vehicles, search, statusF, companyF])

  const stats = useMemo(() => ({
    total:     vehicles.length,
    active:    vehicles.filter(v => v.status==='active').length,
    expiring:  vehicles.filter(v => isExpiringSoon(v.insurance_expiry ?? null)).length,
    service:   vehicles.filter(v => isExpiringSoon(v.service_due_date ?? null)).length,
  }), [vehicles])

  function openNew()            { setForm({...EMPTY}); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(v: Vehicle) { setForm({...v}); setEditing(v); setError(''); setShowForm(true) }
  function set(k: string, val: unknown) { setForm(p => ({...p,[k]:val})) }

  async function saveForm() {
    setSaving(true); setError('')
    try {
      const url = editing ? `/api/vehicles/${editing.id}` : '/api/vehicles'
      const res = await fetch(url, { method:editing?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { setError(data.error||'Failed'); return }
      if (editing) setVehicles(v => v.map(x => x.id===editing.id ? data.vehicle : x))
      else         setVehicles(v => [data.vehicle,...v])
      setShowForm(false)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function del(id: number) {
    if (!confirm('Delete this vehicle?')) return
    const res = await fetch(`/api/vehicles/${id}`, { method:'DELETE' })
    if (res.ok) setVehicles(v => v.filter(x => x.id!==id))
  }

  async function openDetail(v: Vehicle) {
    setDetail(v)
    const res = await fetch(`/api/maintenance?vehicle_id=${v.id}`)
    if (res.ok) { const d = await res.json(); setLogs(d.logs) }
  }

  async function saveLog() {
    if (!detail) return
    setSavingLog(true)
    try {
      const res = await fetch('/api/maintenance', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...logForm, vehicle_id: detail.id, cost: Number(logForm.cost) }),
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
          <h1 className="page-title">Fleet & Vehicles</h1>
          <p className="page-sub">{vehicles.length} vehicles across all companies</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Add Vehicle</button>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { icon:'🚗', label:'Total Fleet',        value:String(stats.total),    color:'var(--info)' },
          { icon:'✅', label:'Active',              value:String(stats.active),   color:'var(--primary)' },
          { icon:'⚠️', label:'Insurance Expiring', value:String(stats.expiring), color:'var(--warning)' },
          { icon:'🔧', label:'Service Due',         value:String(stats.service),  color:'var(--danger)' },
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
        <input className="filter-input" type="text" placeholder="🔍  Search plate, make, model, driver…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth:240 }} />
        <select className="filter-select" value={statusF}  onChange={e => setStatusF(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="filter-select" value={companyF} onChange={e => setCompanyF(e.target.value)}>
          <option value="">All companies</option>
          {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {(search||statusF||companyF) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setStatusF(''); setCompanyF('') }}>✕ Clear</button>
        )}
      </div>

      {/* Table */}
      <div className="card table-wrap">
        <table>
          <thead><tr>
            <th>Plate</th><th>Make / Model</th><th>Year</th><th>Company</th>
            <th>Driver</th><th>Fuel</th><th style={{ textAlign:'right' }}>Mileage (km)</th>
            <th>Insurance Expiry</th><th>Service Due</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {filtered.map(v => {
              const insExp  = isExpiringSoon(v.insurance_expiry ?? null)
              const svcDue  = isExpiringSoon(v.service_due_date ?? null)
              return (
                <tr key={v.id} style={{ cursor:'pointer' }} onClick={() => openDetail(v)}>
                  <td style={{ fontWeight:700, fontFamily:'monospace', fontSize:13 }}>{v.reg_plate}</td>
                  <td style={{ fontWeight:500 }}>{v.make} {v.model}</td>
                  <td style={{ fontSize:12, color:'var(--muted)' }}>{v.year||'—'}</td>
                  <td><span className="co-tag">{v.company}</span></td>
                  <td style={{ fontSize:12 }}>{v.assigned_driver||'—'}</td>
                  <td style={{ fontSize:12 }}>{v.fuel_type}</td>
                  <td style={{ textAlign:'right', fontWeight:600 }}>{fmt(v.mileage)}</td>
                  <td>
                    <span style={{ fontSize:12, color: insExp ? 'var(--danger)' : 'var(--muted)', fontWeight: insExp ? 700 : 400 }}>
                      {v.insurance_expiry||'—'} {insExp && '⚠️'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize:12, color: svcDue ? 'var(--warning)' : 'var(--muted)', fontWeight: svcDue ? 700 : 400 }}>
                      {v.service_due_date||'—'} {svcDue && '🔧'}
                    </span>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[v.status]??'badge-gray'}`}>{v.status}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display:'flex', gap:4 }}>
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(v)}>Edit</button>
                      <button className="btn btn-xs" style={{ background:'var(--danger-light)', color:'var(--danger)' }} onClick={() => del(v.id)}>Del</button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length===0 && <tr><td colSpan={11} className="table-empty">No vehicles match your filters</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Detail panel */}
      {detail && (
        <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) setDetail(null) }}>
          <div className="modal" style={{ maxWidth:520, height:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">🚗 {detail.reg_plate}</span>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{detail.make} {detail.model} {detail.year ? `(${detail.year})` : ''}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex:1, overflowY:'auto' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                {[
                  ['Company',          detail.company],
                  ['Status',           detail.status],
                  ['Driver',           detail.assigned_driver||'—'],
                  ['Fuel Type',        detail.fuel_type],
                  ['Mileage',          `${fmt(detail.mileage)} km`],
                  ['Insurance Expiry', detail.insurance_expiry||'—'],
                  ['Service Due Date', detail.service_due_date||'—'],
                  ['Service Due KM',   detail.service_due_km ? `${fmt(detail.service_due_km)} km` : '—'],
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
                <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Service Log</h3>
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
                      <label className="form-label">Provider / Garage</label>
                      <input className="form-input" value={logForm.provider} onChange={e => setLogForm(f => ({...f,provider:e.target.value}))} placeholder="Garage name" />
                    </div>
                    <div className="form-group" style={{ gridColumn:'1/-1' }}>
                      <label className="form-label">Work Done *</label>
                      <textarea className="form-textarea" style={{ minHeight:60 }} value={logForm.description} onChange={e => setLogForm(f => ({...f,description:e.target.value}))} placeholder="e.g. Oil change, brake pads…" />
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
                <div style={{ textAlign:'center', padding:'24px 0', color:'var(--muted)', fontSize:13 }}>No service records yet</div>
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
              <button className="btn btn-secondary" onClick={() => { openEdit(detail); setDetail(null) }}>Edit Vehicle</button>
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
              <span className="modal-title">{editing?'Edit Vehicle':'Add Vehicle'}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Registration Plate *</label>
                  <input className="form-input" value={form.reg_plate||''} onChange={e => set('reg_plate',e.target.value)} placeholder="e.g. KBZ 123A" style={{ textTransform:'uppercase' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Company *</label>
                  <select className="form-select" value={form.company||''} onChange={e => set('company',e.target.value)}>
                    <option value="">Select company…</option>
                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Make *</label>
                  <input className="form-input" value={form.make||''} onChange={e => set('make',e.target.value)} placeholder="e.g. Toyota" />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input className="form-input" value={form.model||''} onChange={e => set('model',e.target.value)} placeholder="e.g. Land Cruiser" />
                </div>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input className="form-input" type="number" min="1990" max="2030" value={form.year||''} onChange={e => set('year',Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fuel Type</label>
                  <select className="form-select" value={form.fuel_type||'Diesel'} onChange={e => set('fuel_type',e.target.value)}>
                    {FUEL_TYPES.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Assigned Driver</label>
                  <input className="form-input" value={form.assigned_driver||''} onChange={e => set('assigned_driver',e.target.value)} placeholder="Driver name" />
                </div>
                <div className="form-group">
                  <label className="form-label">Current Mileage (km)</label>
                  <input className="form-input" type="number" min="0" value={form.mileage||0} onChange={e => set('mileage',Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Insurance Expiry</label>
                  <input className="form-input" type="date" value={form.insurance_expiry||''} onChange={e => set('insurance_expiry',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Due Date</label>
                  <input className="form-input" type="date" value={form.service_due_date||''} onChange={e => set('service_due_date',e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Service Due (km)</label>
                  <input className="form-input" type="number" min="0" value={form.service_due_km||0} onChange={e => set('service_due_km',Number(e.target.value))} />
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
              <button className="btn btn-primary" onClick={saveForm} disabled={saving}>{saving?'Saving…':editing?'Save Changes':'Add Vehicle'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
