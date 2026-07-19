'use client'

import { useState, useMemo } from 'react'
import type { Vehicle } from '@/lib/db'

const COMPANIES  = ['BERLIN_BNK','BYTEWISE','DR.PHARMA','EPPL','EURO TOWERS','GHPL','IIGENTRA','KISCOL','MALEE','MALI CREDIT','MAXITOWER','MERCURY','PDL','PIL','UNIFRESH','USM','WELWYN']
const FUEL_TYPES = ['Petrol','Diesel','Electric','Hybrid','LPG']
const STATUSES   = ['active','maintenance','grounded','sold']
const CURRENCIES = ['KES','USD','EUR','GBP','TZS','UGX']

const STATUS_BADGE: Record<string,string> = { active:'badge-green', maintenance:'badge-yellow', grounded:'badge-red', sold:'badge-gray' }

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits:0, maximumFractionDigits:0 }) }

const TODAY = new Date().toISOString().slice(0,10)

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000*60*60*24))
}
function expiryColor(days: number | null): string {
  if (days === null) return 'var(--muted)'
  if (days < 0)  return 'var(--danger)'
  if (days <= 30) return 'var(--warning)'
  return 'var(--muted)'
}
function expiryIcon(days: number | null): string {
  if (days === null) return ''
  if (days < 0)  return ' 🔴'
  if (days <= 30) return ' ⚠️'
  return ''
}

const EMPTY: Partial<Vehicle> = {
  reg_plate:'', make:'', model:'', year: new Date().getFullYear(),
  company:'', assigned_driver:'', fuel_type:'Diesel', mileage:0,
  insurance_expiry:'', inspection_expiry:'', road_license_expiry:'',
  driver_license_expiry:'', psv_license_expiry:'',
  service_due_date:'', service_due_km:0, status:'active', notes:'',
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(vehicles: Vehicle[]) {
  const headers = [
    'Plate','Make','Model','Year','Company','Driver','Fuel','Mileage (km)',
    'Insurance Expiry','Inspection Expiry','Road License Expiry',
    'Driver License Expiry','PSV License Expiry',
    'Service Due Date','Service Due KM','Status','Notes',
  ]
  const rows = vehicles.map(v => [
    v.reg_plate, v.make, v.model, v.year??'', v.company,
    v.assigned_driver, v.fuel_type, v.mileage,
    v.insurance_expiry??'', v.inspection_expiry??'', v.road_license_expiry??'',
    v.driver_license_expiry??'', v.psv_license_expiry??'',
    v.service_due_date??'', v.service_due_km??'', v.status, v.notes,
  ])
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(','))
    .join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url
  a.download = `fleet-register-${TODAY}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function exportPDF(vehicles: Vehicle[]) {
  const byCompany: Record<string, Vehicle[]> = {}
  for (const v of vehicles) { (byCompany[v.company] ??= []).push(v) }

  const expiryStyle = (d: string | null) => {
    const days = daysUntil(d)
    if (days === null || !d) return 'color:#6b7280'
    if (days < 0)  return 'color:#dc2626;font-weight:700'
    if (days <= 30) return 'color:#b45309;font-weight:700'
    return 'color:#374151'
  }

  const rows = Object.entries(byCompany).map(([co, list]) => `
    <tr style="background:#f0fdf4"><td colspan="9" style="padding:8px 12px;font-weight:700;font-size:13px;color:#14532d;border-bottom:2px solid #16a34a">${co} &mdash; ${list.length} vehicle${list.length!==1?'s':''}</td></tr>
    ${list.map(v => `<tr>
      <td>${v.reg_plate}</td>
      <td>${v.make} ${v.model}${v.year?` (${v.year})`:''}</td>
      <td>${v.assigned_driver||'—'}</td>
      <td style="${expiryStyle(v.insurance_expiry)}">${v.insurance_expiry||'—'}</td>
      <td style="${expiryStyle(v.inspection_expiry)}">${v.inspection_expiry||'—'}</td>
      <td style="${expiryStyle(v.road_license_expiry)}">${v.road_license_expiry||'—'}</td>
      <td style="${expiryStyle(v.driver_license_expiry)}">${v.driver_license_expiry||'—'}</td>
      <td>${v.service_due_date||'—'}</td>
      <td><span style="padding:2px 8px;border-radius:10px;font-size:11px;font-weight:600;background:${v.status==='active'?'#dcfce7':v.status==='maintenance'?'#fef3c7':'#fee2e2'};color:${v.status==='active'?'#15803d':v.status==='maintenance'?'#92400e':'#991b1b'}">${v.status}</span></td>
    </tr>`).join('')}
  `).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Fleet Register</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:12px;margin:20px;color:#111}
    h1{font-size:18px;color:#14532d;margin-bottom:4px}
    .sub{font-size:11px;color:#6b7280;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th{background:#14532d;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.5px}
    td{padding:5px 8px;border-bottom:1px solid #e5e7eb;vertical-align:middle}
    tr:hover td{background:#f9fafb}
    @media print{body{margin:10px}h1{font-size:15px}th,td{padding:4px 6px}}
  </style></head><body>
  <h1>Fleet & Vehicles Register</h1>
  <div class="sub">Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;|&nbsp; ${vehicles.length} vehicles total</div>
  <table>
    <thead><tr>
      <th>Plate</th><th>Make / Model</th><th>Driver</th>
      <th>Insurance</th><th>Inspection</th><th>Road License</th><th>Driver License</th>
      <th>Service Due</th><th>Status</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`

  const win = window.open('','_blank')
  win?.document.write(html); win?.document.close()
}

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [collapsed, setCollapsed]     = useState<Record<string,boolean>>({})

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

  const byCompany = useMemo(() => {
    const map: Record<string, Vehicle[]> = {}
    for (const v of filtered) { (map[v.company] ??= []).push(v) }
    return map
  }, [filtered])

  const stats = useMemo(() => {
    const alertFields = ['insurance_expiry','inspection_expiry','road_license_expiry','driver_license_expiry','psv_license_expiry'] as const
    let expiring = 0
    for (const v of vehicles) {
      for (const f of alertFields) {
        const days = daysUntil(v[f])
        if (days !== null && days <= 30) { expiring++; break }
      }
    }
    return {
      total:    vehicles.length,
      active:   vehicles.filter(v => v.status==='active').length,
      expiring,
      service:  vehicles.filter(v => { const d = daysUntil(v.service_due_date); return d !== null && d <= 30 }).length,
    }
  }, [vehicles])

  function openNew()            { setForm({...EMPTY}); setEditing(null); setError(''); setShowForm(true) }
  function openEdit(v: Vehicle) { setForm({...v, psv_license_expiry: v.psv_license_expiry??'', driver_license_expiry: v.driver_license_expiry??'', inspection_expiry: v.inspection_expiry??'', road_license_expiry: v.road_license_expiry??'' }); setEditing(v); setError(''); setShowForm(true) }
  function set(k: string, val: unknown) { setForm(p => ({...p,[k]:val})) }
  function toggleCollapse(co: string) { setCollapsed(c => ({...c,[co]:!c[co]})) }

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
        if (logForm.next_service) {
          const patch = await fetch(`/api/vehicles/${detail.id}`, {
            method:'PATCH', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({ service_due_date: logForm.next_service }),
          })
          if (patch.ok) {
            const pdata = await patch.json()
            setVehicles(v => v.map(x => x.id===detail.id ? pdata.vehicle : x))
            setDetail(pdata.vehicle)
          }
        }
        setLogForm({ date:TODAY, description:'', cost:0, currency:'KES', provider:'', next_service:'' })
        setShowLogForm(false)
      }
    } finally { setSavingLog(false) }
  }

  // Compliance field display helper
  const complianceFields: { key: keyof Vehicle; label: string }[] = [
    { key:'insurance_expiry',      label:'Insurance' },
    { key:'inspection_expiry',     label:'Inspection / TLB' },
    { key:'road_license_expiry',   label:'Road License' },
    { key:'driver_license_expiry', label:'Driver License' },
    { key:'psv_license_expiry',    label:'PSV License' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet & Vehicles</h1>
          <p className="page-sub">{vehicles.length} vehicles across {Object.keys(byCompany).length} companies</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={() => exportCSV(filtered)} title="Download Excel/CSV">📥 Excel</button>
          <button className="btn btn-secondary" onClick={() => exportPDF(filtered)} title="Print / Save PDF">🖨️ PDF</button>
          <button className="btn btn-primary" onClick={openNew}>+ Add Vehicle</button>
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
        {[
          { icon:'🚗', label:'Total Fleet',        value:String(stats.total),    color:'var(--info)' },
          { icon:'✅', label:'Active',              value:String(stats.active),   color:'var(--primary)' },
          { icon:'⚠️', label:'Compliance Alert',   value:String(stats.expiring), color:'var(--warning)' },
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
        <input className="filter-input" type="text" placeholder="🔍  Search plate, make, model, driver…" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth:220 }} />
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

      {/* Company-grouped table */}
      {Object.keys(byCompany).length === 0 ? (
        <div className="card" style={{ padding:48, textAlign:'center', color:'var(--muted)' }}>No vehicles match your filters</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {Object.entries(byCompany).map(([co, list]) => {
            const isCollapsed = collapsed[co]
            const hasAlert = list.some(v => {
              for (const f of ['insurance_expiry','inspection_expiry','road_license_expiry','driver_license_expiry','psv_license_expiry'] as const) {
                const d = daysUntil(v[f]); if (d !== null && d <= 30) return true
              }
              return false
            })
            return (
              <div key={co} className="card" style={{ overflow:'hidden' }}>
                {/* Company header */}
                <div
                  onClick={() => toggleCollapse(co)}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', background:'var(--primary-light)', borderBottom: isCollapsed?'none':'1px solid var(--border)', cursor:'pointer', userSelect:'none' }}
                >
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--primary)', flex:1 }}>{co}</span>
                  <span style={{ fontSize:12, color:'var(--muted)' }}>{list.length} vehicle{list.length!==1?'s':''}</span>
                  {hasAlert && <span style={{ fontSize:11, background:'#fef3c7', color:'#92400e', padding:'1px 8px', borderRadius:10, fontWeight:700 }}>⚠️ Expiry alert</span>}
                  <span style={{ fontSize:12, color:'var(--muted)' }}>{isCollapsed ? '▶' : '▼'}</span>
                </div>

                {!isCollapsed && (
                  <div style={{ overflowX:'auto' }}>
                    <table>
                      <thead><tr>
                        <th>Plate</th>
                        <th>Make / Model</th>
                        <th>Driver</th>
                        <th>Insurance</th>
                        <th>Inspection</th>
                        <th>Road Lic.</th>
                        <th>Driver Lic.</th>
                        <th>PSV Lic.</th>
                        <th>Service Due</th>
                        <th style={{ textAlign:'right' }}>KM</th>
                        <th>Status</th>
                        <th></th>
                      </tr></thead>
                      <tbody>
                        {list.map(v => {
                          const svcDays = daysUntil(v.service_due_date)
                          return (
                            <tr key={v.id} style={{ cursor:'pointer' }} onClick={() => openDetail(v)}>
                              <td style={{ fontWeight:700, fontFamily:'monospace', fontSize:13, whiteSpace:'nowrap' }}>{v.reg_plate}</td>
                              <td style={{ fontSize:12 }}>{v.make} {v.model}{v.year ? ` (${v.year})` : ''}</td>
                              <td style={{ fontSize:12 }}>{v.assigned_driver||'—'}</td>
                              {complianceFields.slice(0,4).map(({ key }) => {
                                const days = daysUntil(v[key] as string|null)
                                const val  = v[key] as string|null
                                return (
                                  <td key={key} style={{ fontSize:11, whiteSpace:'nowrap', color: expiryColor(days), fontWeight: days!==null&&days<=30?700:400 }}>
                                    {val||'—'}{expiryIcon(days)}
                                  </td>
                                )
                              })}
                              {/* PSV */}
                              {(() => {
                                const days = daysUntil(v.psv_license_expiry)
                                return <td style={{ fontSize:11, whiteSpace:'nowrap', color:expiryColor(days), fontWeight:days!==null&&days<=30?700:400 }}>{v.psv_license_expiry||'—'}{expiryIcon(days)}</td>
                              })()}
                              <td style={{ fontSize:11, whiteSpace:'nowrap', color: svcDays!==null&&svcDays<=30?'var(--warning)':'var(--muted)', fontWeight: svcDays!==null&&svcDays<=30?700:400 }}>
                                {v.service_due_date||'—'}{svcDays!==null&&svcDays<=30?' 🔧':''}
                              </td>
                              <td style={{ textAlign:'right', fontSize:12 }}>{fmt(v.mileage)}</td>
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
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Detail panel */}
      {detail && (
        <div className="modal-backdrop" onClick={e => { if (e.target===e.currentTarget) setDetail(null) }}>
          <div className="modal" style={{ maxWidth:560, height:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
            <div className="modal-header">
              <div>
                <span className="modal-title">🚗 {detail.reg_plate}</span>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{detail.make} {detail.model}{detail.year ? ` (${detail.year})` : ''} &mdash; {detail.company}</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ flex:1, overflowY:'auto' }}>

              {/* Compliance grid */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Compliance & Expiry</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { label:'Insurance',       val: detail.insurance_expiry },
                    { label:'Inspection / TLB',val: detail.inspection_expiry },
                    { label:'Road License',    val: detail.road_license_expiry },
                    { label:'Driver License',  val: detail.driver_license_expiry },
                    { label:'PSV License',     val: detail.psv_license_expiry },
                    { label:'Service Due',     val: detail.service_due_date },
                  ].map(({ label, val }) => {
                    const days = daysUntil(val??null)
                    const expired = days !== null && days < 0
                    const soon    = days !== null && days >= 0 && days <= 30
                    return (
                      <div key={label} style={{ padding:'8px 10px', borderRadius:8, border:`1px solid ${expired?'#fecaca':soon?'#fde68a':'var(--border)'}`, background:expired?'#fff5f5':soon?'#fffbeb':'var(--surface)' }}>
                        <div style={{ fontSize:10, color:'var(--muted)', fontWeight:600, textTransform:'uppercase', marginBottom:2 }}>{label}</div>
                        <div style={{ fontSize:13, fontWeight:600, color: expired?'var(--danger)':soon?'var(--warning)':'var(--text)' }}>
                          {val||'—'}
                          {expired && <span style={{ fontSize:11, marginLeft:6 }}>EXPIRED</span>}
                          {soon    && <span style={{ fontSize:11, marginLeft:6 }}>({days}d left)</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Vehicle details */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                {[
                  ['Status',      detail.status],
                  ['Driver',      detail.assigned_driver||'—'],
                  ['Fuel Type',   detail.fuel_type],
                  ['Mileage',     `${fmt(detail.mileage)} km`],
                  ['Service KM',  detail.service_due_km ? `${fmt(detail.service_due_km)} km` : '—'],
                ].map(([k,v]) => (
                  <div key={k}>
                    <div style={{ fontSize:10, color:'var(--muted)', textTransform:'uppercase', fontWeight:600, marginBottom:2 }}>{k}</div>
                    <div style={{ fontSize:13, fontWeight:500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {detail.notes && (
                <div style={{ padding:'10px 14px', background:'var(--bg)', borderRadius:8, fontSize:13, color:'var(--muted)', marginBottom:16 }}>{detail.notes}</div>
              )}

              {/* Service log */}
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
                      <textarea className="form-textarea" style={{ minHeight:56 }} value={logForm.description} onChange={e => setLogForm(f => ({...f,description:e.target.value}))} placeholder="e.g. Oil change, brake pads, tyre rotation…" />
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
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--muted)', fontSize:13 }}>No service records yet</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {logs.map(l => (
                    <div key={l.id} style={{ padding:'10px 14px', border:'1px solid var(--border)', borderRadius:8 }}>
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
                  <input className="form-input" value={form.reg_plate||''} onChange={e => set('reg_plate',e.target.value.toUpperCase())} placeholder="e.g. KBZ 123A" />
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
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status||'active'} onChange={e => set('status',e.target.value)}>
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Service Due (km)</label>
                  <input className="form-input" type="number" min="0" value={form.service_due_km||0} onChange={e => set('service_due_km',Number(e.target.value))} />
                </div>
              </div>

              {/* Compliance section */}
              <div style={{ margin:'16px 0 8px', fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px' }}>Compliance & Expiry Dates</div>
              <div className="form-grid">
                {[
                  { key:'insurance_expiry',      label:'Insurance Expiry' },
                  { key:'inspection_expiry',     label:'Inspection / TLB Expiry' },
                  { key:'road_license_expiry',   label:'Road License Expiry' },
                  { key:'driver_license_expiry', label:'Driver License Expiry' },
                  { key:'psv_license_expiry',    label:'PSV License Expiry' },
                  { key:'service_due_date',      label:'Service Due Date' },
                ].map(({ key, label }) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <input className="form-input" type="date" value={(form as Record<string,unknown>)[key] as string||''} onChange={e => set(key, e.target.value)} />
                  </div>
                ))}
              </div>

              <div className="form-group" style={{ marginTop:8 }}>
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" value={form.notes||''} onChange={e => set('notes',e.target.value)} placeholder="Additional notes…" />
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
