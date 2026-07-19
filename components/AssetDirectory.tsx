'use client'

import { useState, useMemo } from 'react'
import type { Asset, Vehicle, MaintenanceLog } from '@/lib/assets'

const COMPANIES = ['BERLIN_BNK','BYTEWISE','DR.PHARMA','EPPL','EURO TOWERS','GHPL','IIGENTRA','KISCOL','MALEE','MALI CREDIT','MAXITOWER','MERCURY','PDL','PIL','UNIFRESH','USM','WELWYN']
const ASSET_TYPES  = ['Equipment','Furniture','Vehicle','IT/Electronics','Land','Building','Machinery','Tools','Other']
const STATUSES_A   = ['active','maintenance','disposed','inactive']
const STATUSES_V   = ['active','maintenance','grounded','sold']
const FUEL_TYPES   = ['Petrol','Diesel','Electric','Hybrid','LPG']
const CURRENCIES   = ['KES','USD','EUR','GBP','TZS','UGX']
const TYPE_ICON: Record<string,string> = { Equipment:'⚙️', Furniture:'🪑', Vehicle:'🚗', 'IT/Electronics':'💻', Land:'🌍', Building:'🏢', Machinery:'🔧', Tools:'🔨', Other:'📦' }
const BADGE_A: Record<string,string>   = { active:'badge-green', maintenance:'badge-yellow', disposed:'badge-red', inactive:'badge-gray' }
const BADGE_V: Record<string,string>   = { active:'badge-green', maintenance:'badge-yellow', grounded:'badge-red', sold:'badge-gray' }

const TODAY = new Date().toISOString().slice(0,10)

function fmt(n: number) { return n.toLocaleString('en-KE', { minimumFractionDigits:0, maximumFractionDigits:0 }) }
function fmtS(n: number) { return n>=1e6?`${(n/1e6).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(0)}K`:fmt(n) }
function daysUntil(d: string|null) { return d ? Math.ceil((new Date(d).getTime()-Date.now())/(864e5)) : null }

// ── Export helpers ────────────────────────────────────────────────────────────

function csv(rows: (string|number|null)[][]) {
  return rows.map(r => r.map(c=>`"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n')
}
function download(content: string, filename: string) {
  const blob = new Blob(['﻿'+content],{type:'text/csv;charset=utf-8;'})
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href=url; a.download=filename; a.click()
  URL.revokeObjectURL(url)
}
function printWindow(html: string) {
  const win = window.open('','_blank'); win?.document.write(html); win?.document.close()
}

function exportAssetsCSV(assets: Asset[]) {
  download(csv([
    ['Asset No','Name','Type','Company','Location','Department','Assigned To','Serial No','Purchase Date','Currency','Purchase Cost','Current Value','Status'],
    ...assets.map(a=>[a.asset_no,a.name,a.type,a.company,a.location,a.department,a.assigned_to,a.serial_no,a.purchase_date??'',a.currency,a.purchase_cost,a.current_value,a.status])
  ]), `asset-directory-${TODAY}.csv`)
}

function exportVehiclesCSV(vehicles: Vehicle[]) {
  download(csv([
    ['Plate','Make','Model','Year','Company','Driver','Fuel','Mileage','Insurance','Inspection','Road Lic','Driver Lic','PSV Lic','Service Due','Status'],
    ...vehicles.map(v=>[v.reg_plate,v.make,v.model,v.year??'',v.company,v.assigned_driver,v.fuel_type,v.mileage,v.insurance_expiry??'',v.inspection_expiry??'',v.road_license_expiry??'',v.driver_license_expiry??'',v.psv_license_expiry??'',v.service_due_date??'',v.status])
  ]), `fleet-register-${TODAY}.csv`)
}

function exportAssetsPDF(assets: Asset[]) {
  const byComp: Record<string,Asset[]> = {}
  for (const a of assets) { (byComp[a.company]??=[]).push(a) }
  const rows = Object.entries(byComp).map(([co,list])=>`
    <tr style="background:#f0fdf4"><td colspan="7" style="padding:7px 10px;font-weight:700;font-size:12px;color:#14532d;border-bottom:2px solid #16a34a">${co} — ${list.length} asset${list.length!==1?'s':''} | Total: KES ${list.reduce((s,a)=>s+a.current_value,0).toLocaleString('en-KE',{maximumFractionDigits:0})}</td></tr>
    ${list.map(a=>`<tr><td style="font-family:monospace;font-size:10px">${a.asset_no}</td><td>${a.name}</td><td>${a.type}</td><td>${a.location||'—'}</td><td>${a.assigned_to||'—'}</td><td style="text-align:right">${a.currency} ${fmt(a.current_value)}</td><td style="text-align:right">${a.currency} ${fmt(a.purchase_cost)}</td></tr>`).join('')}
  `).join('')
  printWindow(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Asset Directory</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1{font-size:18px;color:#14532d;margin-bottom:4px}.sub{font-size:11px;color:#6b7280;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#14532d;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}</style></head><body><h1>Asset Directory</h1><div class="sub">Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})} | ${assets.length} assets</div><table><thead><tr><th>Asset No</th><th>Name</th><th>Type</th><th>Location</th><th>Assigned To</th><th style="text-align:right">Current Value</th><th style="text-align:right">Cost</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
}

function exportVehiclesPDF(vehicles: Vehicle[]) {
  const byComp: Record<string,Vehicle[]> = {}
  for (const v of vehicles) { (byComp[v.company]??=[]).push(v) }
  const expiryStyle = (d:string|null) => { const days=daysUntil(d); return !d?'color:#6b7280':days!<0?'color:#dc2626;font-weight:700':days!<=30?'color:#b45309;font-weight:700':'color:#374151' }
  const rows = Object.entries(byComp).map(([co,list])=>`
    <tr style="background:#f0fdf4"><td colspan="8" style="padding:7px 10px;font-weight:700;font-size:12px;color:#14532d;border-bottom:2px solid #16a34a">${co} — ${list.length} vehicle${list.length!==1?'s':''}</td></tr>
    ${list.map(v=>`<tr><td>${v.reg_plate}</td><td>${v.make} ${v.model}${v.year?` (${v.year})`:''}</td><td>${v.assigned_driver||'—'}</td><td style="${expiryStyle(v.insurance_expiry)}">${v.insurance_expiry||'—'}</td><td style="${expiryStyle(v.inspection_expiry)}">${v.inspection_expiry||'—'}</td><td style="${expiryStyle(v.road_license_expiry)}">${v.road_license_expiry||'—'}</td><td>${v.service_due_date||'—'}</td><td>${v.status}</td></tr>`).join('')}
  `).join('')
  printWindow(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fleet Register</title><style>body{font-family:Arial,sans-serif;font-size:12px;margin:20px}h1{font-size:18px;color:#14532d;margin-bottom:4px}.sub{font-size:11px;color:#6b7280;margin-bottom:16px}table{width:100%;border-collapse:collapse}th{background:#14532d;color:#fff;padding:6px 8px;text-align:left;font-size:10px;text-transform:uppercase}td{padding:5px 8px;border-bottom:1px solid #e5e7eb}</style></head><body><h1>Fleet & Vehicles Register</h1><div class="sub">Generated ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})} | ${vehicles.length} vehicles</div><table><thead><tr><th>Plate</th><th>Make/Model</th><th>Driver</th><th>Insurance</th><th>Inspection</th><th>Road Lic</th><th>Service Due</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>window.print()</script></body></html>`)
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function AssetDirectory({
  assets: initAssets, vehicles: initVehicles, userEmail, canEdit,
}: {
  assets: Asset[]; vehicles: Vehicle[]; userEmail: string; canEdit: boolean
}) {
  const [tab, setTab] = useState<'assets'|'fleet'>('assets')

  // ── Assets state ──────────────────────────────────────────────────────────
  const [assets, setAssets]     = useState(initAssets)
  const [aSearch, setASearch]   = useState('')
  const [aTypeF, setATypeF]     = useState('')
  const [aStatusF, setAStatusF] = useState('')
  const [aCoF, setACoF]         = useState('')
  const [aCollapsed, setACollapsed] = useState<Record<string,boolean>>({})
  const [aDetail, setADetail]   = useState<Asset|null>(null)
  const [aLogs, setALogs]       = useState<MaintenanceLog[]>([])
  const [aShowForm, setAShowForm] = useState(false)
  const [aEditing, setAEditing] = useState<Asset|null>(null)
  const [aForm, setAForm]       = useState<Partial<Asset>>({})
  const [aSaving, setASaving]   = useState(false)
  const [aError, setAError]     = useState('')
  const [aLogForm, setALogForm] = useState({ date:TODAY, description:'', cost:0, currency:'KES', provider:'', next_service:'' })
  const [aShowLog, setAShowLog] = useState(false)
  const [aSavingLog, setASavingLog] = useState(false)

  // ── Vehicles state ────────────────────────────────────────────────────────
  const [vehicles, setVehicles]   = useState(initVehicles)
  const [vSearch, setVSearch]     = useState('')
  const [vStatusF, setVStatusF]   = useState('')
  const [vCoF, setVCoF]           = useState('')
  const [vCollapsed, setVCollapsed] = useState<Record<string,boolean>>({})
  const [vDetail, setVDetail]     = useState<Vehicle|null>(null)
  const [vLogs, setVLogs]         = useState<MaintenanceLog[]>([])
  const [vShowForm, setVShowForm] = useState(false)
  const [vEditing, setVEditing]   = useState<Vehicle|null>(null)
  const [vForm, setVForm]         = useState<Partial<Vehicle>>({})
  const [vSaving, setVSaving]     = useState(false)
  const [vError, setVError]       = useState('')
  const [vLogForm, setVLogForm]   = useState({ date:TODAY, description:'', cost:0, currency:'KES', provider:'', next_service:'' })
  const [vShowLog, setVShowLog]   = useState(false)
  const [vSavingLog, setVSavingLog] = useState(false)

  // ── Filtered / grouped ────────────────────────────────────────────────────
  const filteredA = useMemo(()=>assets.filter(a=>{
    if (aTypeF && a.type!==aTypeF) return false
    if (aStatusF && a.status!==aStatusF) return false
    if (aCoF && a.company!==aCoF) return false
    if (aSearch){const q=aSearch.toLowerCase();return a.name.toLowerCase().includes(q)||a.asset_no.toLowerCase().includes(q)||a.company.toLowerCase().includes(q)||a.assigned_to.toLowerCase().includes(q)}
    return true
  }),[assets,aSearch,aTypeF,aStatusF,aCoF])

  const byCoA = useMemo(()=>{const m:Record<string,Asset[]>={};for(const a of filteredA){(m[a.company]??=[]).push(a)};return m},[filteredA])

  const filteredV = useMemo(()=>vehicles.filter(v=>{
    if (vStatusF && v.status!==vStatusF) return false
    if (vCoF && v.company!==vCoF) return false
    if (vSearch){const q=vSearch.toLowerCase();return v.reg_plate.toLowerCase().includes(q)||v.make.toLowerCase().includes(q)||v.company.toLowerCase().includes(q)||v.assigned_driver.toLowerCase().includes(q)}
    return true
  }),[vehicles,vSearch,vStatusF,vCoF])

  const byCoV = useMemo(()=>{const m:Record<string,Vehicle[]>={};for(const v of filteredV){(m[v.company]??=[]).push(v)};return m},[filteredV])

  const statsA = useMemo(()=>({ total:assets.length, active:assets.filter(a=>a.status==='active').length, value:assets.reduce((s,a)=>s+a.current_value,0) }),[assets])
  const statsV = useMemo(()=>{
    let expiring=0
    for(const v of vehicles){
      for(const f of ['insurance_expiry','inspection_expiry','road_license_expiry','driver_license_expiry','psv_license_expiry'] as const){
        const d=daysUntil(v[f]);if(d!==null&&d<=30){expiring++;break}
      }
    }
    return {total:vehicles.length,active:vehicles.filter(v=>v.status==='active').length,expiring}
  },[vehicles])

  // ── Asset CRUD ────────────────────────────────────────────────────────────
  function openNewA() { setAForm({asset_no:'',name:'',type:'Equipment',company:'',location:'',department:'',assigned_to:'',purchase_date:TODAY,purchase_cost:0,current_value:0,currency:'KES',status:'active',serial_no:'',notes:''}); setAEditing(null); setAError(''); setAShowForm(true) }
  function openEditA(a:Asset) { setAForm({...a}); setAEditing(a); setAError(''); setAShowForm(true) }

  async function saveA() {
    setASaving(true); setAError('')
    try {
      const url = aEditing?`/api/assets/${aEditing.id}`:'/api/assets'
      const res = await fetch(url,{method:aEditing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(aForm)})
      const d   = await res.json()
      if(!res.ok){setAError(d.error||'Failed');return}
      if(aEditing) setAssets(x=>x.map(a=>a.id===aEditing.id?d.asset:a))
      else         setAssets(x=>[d.asset,...x])
      setAShowForm(false)
    } catch{setAError('Network error')} finally{setASaving(false)}
  }

  async function delA(id:number) {
    if(!confirm('Delete this asset?')) return
    const res=await fetch(`/api/assets/${id}`,{method:'DELETE'})
    if(res.ok) setAssets(x=>x.filter(a=>a.id!==id))
  }

  async function openDetailA(a:Asset) {
    setADetail(a); setAShowLog(false)
    const res=await fetch(`/api/maintenance?asset_id=${a.id}`)
    if(res.ok){const d=await res.json();setALogs(d.logs)}
  }

  async function saveALog() {
    if(!aDetail) return
    setASavingLog(true)
    try {
      const res=await fetch('/api/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...aLogForm,asset_id:aDetail.id,cost:Number(aLogForm.cost)})})
      const d=await res.json()
      if(res.ok){setALogs(l=>[d.log,...l]);setALogForm({date:TODAY,description:'',cost:0,currency:'KES',provider:'',next_service:''});setAShowLog(false)}
    } finally{setASavingLog(false)}
  }

  // ── Vehicle CRUD ──────────────────────────────────────────────────────────
  function openNewV() { setVForm({reg_plate:'',make:'',model:'',year:new Date().getFullYear(),company:'',assigned_driver:'',fuel_type:'Diesel',mileage:0,insurance_expiry:'',inspection_expiry:'',road_license_expiry:'',driver_license_expiry:'',psv_license_expiry:'',service_due_date:'',service_due_km:0,status:'active',notes:''}); setVEditing(null); setVError(''); setVShowForm(true) }
  function openEditV(v:Vehicle) { setVForm({...v}); setVEditing(v); setVError(''); setVShowForm(true) }

  async function saveV() {
    setVSaving(true); setVError('')
    try {
      const url=vEditing?`/api/vehicles/${vEditing.id}`:'/api/vehicles'
      const res=await fetch(url,{method:vEditing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(vForm)})
      const d=await res.json()
      if(!res.ok){setVError(d.error||'Failed');return}
      if(vEditing) setVehicles(x=>x.map(v=>v.id===vEditing.id?d.vehicle:v))
      else         setVehicles(x=>[d.vehicle,...x])
      setVShowForm(false)
    } catch{setVError('Network error')} finally{setVSaving(false)}
  }

  async function delV(id:number) {
    if(!confirm('Delete this vehicle?')) return
    const res=await fetch(`/api/vehicles/${id}`,{method:'DELETE'})
    if(res.ok) setVehicles(x=>x.filter(v=>v.id!==id))
  }

  async function openDetailV(v:Vehicle) {
    setVDetail(v); setVShowLog(false)
    const res=await fetch(`/api/maintenance?vehicle_id=${v.id}`)
    if(res.ok){const d=await res.json();setVLogs(d.logs)}
  }

  async function saveVLog() {
    if(!vDetail) return
    setVSavingLog(true)
    try {
      const res=await fetch('/api/maintenance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...vLogForm,vehicle_id:vDetail.id,cost:Number(vLogForm.cost)})})
      const d=await res.json()
      if(res.ok){
        setVLogs(l=>[d.log,...l])
        if(vLogForm.next_service){
          const p=await fetch(`/api/vehicles/${vDetail.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({service_due_date:vLogForm.next_service})})
          if(p.ok){const pd=await p.json();setVehicles(x=>x.map(v=>v.id===vDetail.id?pd.vehicle:v));setVDetail(pd.vehicle)}
        }
        setVLogForm({date:TODAY,description:'',cost:0,currency:'KES',provider:'',next_service:''})
        setVShowLog(false)
      }
    } finally{setVSavingLog(false)}
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const card = { background:'white', borderRadius:12, border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,.05)' }

  const TH = { padding:'8px 14px', textAlign:'left' as const, fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase' as const, letterSpacing:'.5px', whiteSpace:'nowrap' as const }

  function CompanyHeader({ co, count, extra, onToggle, collapsed, alert }: { co:string; count:number; extra?:string; onToggle:()=>void; collapsed:boolean; alert?:boolean }) {
    return (
      <div onClick={onToggle} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'#f0fdf4', borderBottom:collapsed?'none':'1px solid #e5e7eb', cursor:'pointer', userSelect:'none' }}>
        <span style={{ fontSize:13, fontWeight:700, color:'#15803d', flex:1 }}>{co}</span>
        <span style={{ fontSize:12, color:'#6b7280' }}>{count} {count===1?'item':'items'}</span>
        {extra && <span style={{ fontSize:12, color:'#15803d', fontWeight:600 }}>{extra}</span>}
        {alert && <span style={{ fontSize:11, background:'#fef3c7', color:'#92400e', padding:'1px 8px', borderRadius:10, fontWeight:700 }}>⚠️ Expiry alert</span>}
        <span style={{ fontSize:12, color:'#9ca3af' }}>{collapsed?'▶':'▼'}</span>
      </div>
    )
  }

  function LogPanel({ logs, logForm, setLogForm, showLog, setShowLog, onSave, saving }: { logs:MaintenanceLog[]; logForm:typeof aLogForm; setLogForm:(f:typeof aLogForm)=>void; showLog:boolean; setShowLog:(v:boolean)=>void; onSave:()=>void; saving:boolean }) {
    return (
      <>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <h3 style={{ fontSize:14, fontWeight:700, margin:0 }}>Service / Maintenance Log</h3>
          <button onClick={()=>setShowLog(!showLog)} style={{ padding:'5px 12px', borderRadius:6, border:'1px solid #e5e7eb', background:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Log Entry</button>
        </div>
        {showLog && (
          <div style={{ ...card, padding:16, marginBottom:14 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              {[['Date *','date','date'],['Cost','number','cost'],['Provider','text','provider']].map(([lbl,type,key])=>(
                <div key={key}>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{lbl}</label>
                  <input type={type} value={(logForm as Record<string,unknown>)[key] as string} onChange={e=>setLogForm({...logForm,[key]:e.target.value})}
                    style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} />
                </div>
              ))}
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Currency</label>
                <select value={logForm.currency} onChange={e=>setLogForm({...logForm,currency:e.target.value})} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}>
                  {CURRENCIES.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Description *</label>
                <textarea value={logForm.description} onChange={e=>setLogForm({...logForm,description:e.target.value})} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13, minHeight:52, resize:'vertical' }} placeholder="Work done…" />
              </div>
              <div>
                <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Next Service Date</label>
                <input type="date" value={logForm.next_service} onChange={e=>setLogForm({...logForm,next_service:e.target.value})} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:10 }}>
              <button onClick={()=>setShowLog(false)} style={{ padding:'6px 14px', borderRadius:6, border:'1px solid #e5e7eb', background:'white', fontSize:12, cursor:'pointer' }}>Cancel</button>
              <button onClick={onSave} disabled={saving} style={{ padding:'6px 14px', borderRadius:6, border:'none', background:'#15803d', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        )}
        {logs.length===0?(
          <div style={{ textAlign:'center', padding:'20px 0', color:'#9ca3af', fontSize:13 }}>No maintenance records yet</div>
        ):(
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {logs.map(l=>(
              <div key={l.id} style={{ padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontSize:12, fontWeight:600, color:'#6b7280' }}>{l.date}</span>
                  {l.cost>0&&<span style={{ fontSize:12, fontWeight:700, color:'#15803d' }}>{l.currency} {fmt(l.cost)}</span>}
                </div>
                <div style={{ fontSize:13, fontWeight:500 }}>{l.description}</div>
                {l.provider&&<div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>By: {l.provider}</div>}
                {l.next_service&&<div style={{ fontSize:11, color:'#b45309', marginTop:4 }}>Next service: {l.next_service}</div>}
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:'100vh', background:'#f3f4f6', fontFamily:'system-ui,-apple-system,sans-serif' }}>

      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #e5e7eb', padding:'0 32px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <a href="/" style={{ fontSize:13, color:'#6b7280', textDecoration:'none' }}>← Back</a>
          <span style={{ color:'#e5e7eb' }}>|</span>
          <h1 style={{ margin:0, fontSize:16, fontWeight:700, color:'#111827' }}>🗂️ Asset Directory</h1>
        </div>
        {/* Tab bar */}
        <div style={{ display:'flex', gap:4 }}>
          {([['assets','🏗️ Assets'],['fleet','🚗 Fleet & Vehicles']] as const).map(([t,label])=>(
            <button key={t} onClick={()=>setTab(t)} style={{ padding:'6px 16px', borderRadius:6, border:'none', cursor:'pointer', fontSize:13, fontWeight:600, background:tab===t?'#15803d':'transparent', color:tab===t?'white':'#6b7280' }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth:1300, margin:'0 auto', padding:'24px 32px' }}>

        {/* ── ASSETS TAB ─────────────────────────────────────────────────── */}
        {tab==='assets' && (<>
          {/* KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {[
              { icon:'🏗️', label:'Total Assets',   value:String(statsA.total),          color:'#0369a1' },
              { icon:'✅', label:'Active',          value:String(statsA.active),         color:'#15803d' },
              { icon:'💰', label:'Total Book Value',value:`KES ${fmtS(statsA.value)}`,   color:'#15803d' },
            ].map(s=>(
              <div key={s.label} style={{ ...card, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:26 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, textTransform:'uppercase' }}>{s.label}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:s.color, marginTop:2 }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters + export */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
            <input placeholder="🔍 Search name, asset no, assigned to…" value={aSearch} onChange={e=>setASearch(e.target.value)} style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, minWidth:260 }} />
            <select value={aTypeF} onChange={e=>setATypeF(e.target.value)} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13 }}>
              <option value="">All types</option>{ASSET_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
            <select value={aStatusF} onChange={e=>setAStatusF(e.target.value)} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13 }}>
              <option value="">All statuses</option>{STATUSES_A.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={aCoF} onChange={e=>setACoF(e.target.value)} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13 }}>
              <option value="">All companies</option>{COMPANIES.map(c=><option key={c}>{c}</option>)}
            </select>
            {(aSearch||aTypeF||aStatusF||aCoF)&&<button onClick={()=>{setASearch('');setATypeF('');setAStatusF('');setACoF('')}} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', fontSize:12, cursor:'pointer' }}>✕ Clear</button>}
            <div style={{ flex:1 }} />
            <button onClick={()=>exportAssetsCSV(filteredA)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>📥 Excel</button>
            <button onClick={()=>exportAssetsPDF(filteredA)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>🖨️ PDF</button>
            {canEdit&&<button onClick={openNewA} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#15803d', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add Asset</button>}
          </div>

          {/* Company-grouped asset table */}
          {Object.keys(byCoA).length===0
            ? <div style={{ ...card, padding:48, textAlign:'center', color:'#9ca3af' }}>No assets match your filters</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {Object.entries(byCoA).map(([co,list])=>{
                  const collapsed=aCollapsed[co]
                  const val=list.reduce((s,a)=>s+a.current_value,0)
                  return (
                    <div key={co} style={{ ...card, overflow:'hidden' }}>
                      <CompanyHeader co={co} count={list.length} extra={`KES ${fmt(val)}`} onToggle={()=>setACollapsed(c=>({...c,[co]:!c[co]}))} collapsed={!!collapsed} />
                      {!collapsed&&(
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                          <thead><tr style={{ borderBottom:'2px solid #e5e7eb' }}>
                            {['Asset No','Name','Type','Location','Assigned To','Current Value','Status',''].map((h,i)=>(
                              <th key={i} style={{ ...TH, textAlign:h==='Current Value'?'right':'left' }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {list.map(a=>(
                              <tr key={a.id} style={{ borderBottom:'1px solid #f3f4f6', cursor:'pointer' }}
                                onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='#f9fafb'}
                                onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=''}
                                onClick={()=>openDetailA(a)}>
                                <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'#6b7280' }}>{a.asset_no}</td>
                                <td style={{ padding:'10px 14px', fontWeight:600, fontSize:13 }}>{a.name}</td>
                                <td style={{ padding:'10px 14px', fontSize:12 }}>{TYPE_ICON[a.type]||''} {a.type}</td>
                                <td style={{ padding:'10px 14px', fontSize:12, color:'#6b7280' }}>{a.location||'—'}</td>
                                <td style={{ padding:'10px 14px', fontSize:12 }}>{a.assigned_to||'—'}</td>
                                <td style={{ padding:'10px 14px', textAlign:'right', fontWeight:600, fontSize:13 }}>{a.currency} {fmt(a.current_value)}</td>
                                <td style={{ padding:'10px 14px' }}><span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700, background:a.status==='active'?'#dcfce7':a.status==='maintenance'?'#fef3c7':'#fee2e2', color:a.status==='active'?'#15803d':a.status==='maintenance'?'#92400e':'#991b1b' }}>{a.status}</span></td>
                                <td style={{ padding:'10px 14px' }} onClick={e=>e.stopPropagation()}>
                                  {canEdit&&<div style={{ display:'flex', gap:4 }}>
                                    <button onClick={()=>openEditA(a)} style={{ padding:'3px 8px', borderRadius:5, border:'1px solid #e5e7eb', background:'white', fontSize:11, cursor:'pointer' }}>Edit</button>
                                    <button onClick={()=>delA(a.id)} style={{ padding:'3px 8px', borderRadius:5, border:'none', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                                  </div>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </>)}

        {/* ── FLEET TAB ──────────────────────────────────────────────────── */}
        {tab==='fleet' && (<>
          {/* KPI */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            {[
              { icon:'🚗', label:'Total Fleet',      value:String(statsV.total),    color:'#0369a1' },
              { icon:'✅', label:'Active',            value:String(statsV.active),   color:'#15803d' },
              { icon:'⚠️', label:'Compliance Alert', value:String(statsV.expiring), color:'#b45309' },
            ].map(s=>(
              <div key={s.label} style={{ ...card, padding:'14px 18px', display:'flex', alignItems:'center', gap:12 }}>
                <span style={{ fontSize:26 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize:11, color:'#6b7280', fontWeight:600, textTransform:'uppercase' }}>{s.label}</div>
                  <div style={{ fontSize:18, fontWeight:700, color:s.color, marginTop:2 }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters + export */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16, alignItems:'center' }}>
            <input placeholder="🔍 Search plate, make, driver…" value={vSearch} onChange={e=>setVSearch(e.target.value)} style={{ padding:'8px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, minWidth:240 }} />
            <select value={vStatusF} onChange={e=>setVStatusF(e.target.value)} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13 }}>
              <option value="">All statuses</option>{STATUSES_V.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={vCoF} onChange={e=>setVCoF(e.target.value)} style={{ padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13 }}>
              <option value="">All companies</option>{COMPANIES.map(c=><option key={c}>{c}</option>)}
            </select>
            {(vSearch||vStatusF||vCoF)&&<button onClick={()=>{setVSearch('');setVStatusF('');setVCoF('')}} style={{ padding:'8px 12px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', fontSize:12, cursor:'pointer' }}>✕ Clear</button>}
            <div style={{ flex:1 }} />
            <button onClick={()=>exportVehiclesCSV(filteredV)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>📥 Excel</button>
            <button onClick={()=>exportVehiclesPDF(filteredV)} style={{ padding:'8px 14px', borderRadius:8, border:'1px solid #e5e7eb', background:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>🖨️ PDF</button>
            {canEdit&&<button onClick={openNewV} style={{ padding:'8px 16px', borderRadius:8, border:'none', background:'#15803d', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>+ Add Vehicle</button>}
          </div>

          {/* Company-grouped fleet table */}
          {Object.keys(byCoV).length===0
            ? <div style={{ ...card, padding:48, textAlign:'center', color:'#9ca3af' }}>No vehicles match your filters</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {Object.entries(byCoV).map(([co,list])=>{
                  const collapsed=vCollapsed[co]
                  const hasAlert=list.some(v=>{
                    for(const f of ['insurance_expiry','inspection_expiry','road_license_expiry','driver_license_expiry','psv_license_expiry'] as const){
                      const d=daysUntil(v[f]);if(d!==null&&d<=30)return true
                    }
                    return false
                  })
                  return (
                    <div key={co} style={{ ...card, overflow:'hidden' }}>
                      <CompanyHeader co={co} count={list.length} onToggle={()=>setVCollapsed(c=>({...c,[co]:!c[co]}))} collapsed={!!collapsed} alert={hasAlert} />
                      {!collapsed&&(
                        <table style={{ width:'100%', borderCollapse:'collapse' }}>
                          <thead><tr style={{ borderBottom:'2px solid #e5e7eb' }}>
                            {['Plate','Make / Model','Driver','Compliance','Service Due','KM','Status',''].map((h,i)=>(
                              <th key={i} style={{ ...TH, textAlign:h==='KM'?'right':'left' }}>{h}</th>
                            ))}
                          </tr></thead>
                          <tbody>
                            {list.map(v=>{
                              const svcDays=daysUntil(v.service_due_date)
                              const dots=[
                                {abbr:'INS',label:'Insurance',       val:v.insurance_expiry},
                                {abbr:'TLB',label:'Inspection/TLB',  val:v.inspection_expiry},
                                {abbr:'RD', label:'Road License',    val:v.road_license_expiry},
                                {abbr:'DRV',label:'Driver License',  val:v.driver_license_expiry},
                                {abbr:'PSV',label:'PSV License',     val:v.psv_license_expiry},
                              ]
                              return (
                                <tr key={v.id} style={{ borderBottom:'1px solid #f3f4f6', cursor:'pointer' }}
                                  onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='#f9fafb'}
                                  onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=''}
                                  onClick={()=>openDetailV(v)}>
                                  <td style={{ padding:'10px 14px', fontWeight:700, fontFamily:'monospace', fontSize:13, whiteSpace:'nowrap' }}>{v.reg_plate}</td>
                                  <td style={{ padding:'10px 14px' }}>
                                    <div style={{ fontWeight:500, fontSize:13 }}>{v.make} {v.model}</div>
                                    {v.year&&<div style={{ fontSize:11, color:'#9ca3af' }}>{v.year} · {v.fuel_type}</div>}
                                  </td>
                                  <td style={{ padding:'10px 14px', fontSize:13, whiteSpace:'nowrap' }}>{v.assigned_driver||'—'}</td>
                                  <td style={{ padding:'10px 14px' }}>
                                    <div style={{ display:'flex', gap:4 }}>
                                      {dots.map(({abbr,label,val})=>{
                                        const d=daysUntil(val)
                                        const bg=!val?'#f1f5f9':d!<0?'#fee2e2':d!<=30?'#fef3c7':'#dcfce7'
                                        const clr=!val?'#94a3b8':d!<0?'#dc2626':d!<=30?'#92400e':'#15803d'
                                        const tip=val?`${label}: ${val}${d!<0?' — EXPIRED':d!<=30?` — ${d}d left`:''}`:` ${label}: not set`
                                        return <span key={abbr} title={tip} style={{ padding:'2px 6px', borderRadius:4, fontSize:10, fontWeight:700, background:bg, color:clr, letterSpacing:'.3px' }}>{abbr}</span>
                                      })}
                                    </div>
                                  </td>
                                  <td style={{ padding:'10px 14px', fontSize:12, whiteSpace:'nowrap', color:v.service_due_date&&svcDays!<=30?'#b45309':'#6b7280', fontWeight:v.service_due_date&&svcDays!<=30?700:400 }}>
                                    {v.service_due_date||'—'}{v.service_due_date&&svcDays!<=30?' 🔧':''}
                                  </td>
                                  <td style={{ padding:'10px 14px', textAlign:'right', fontSize:12, color:'#6b7280', whiteSpace:'nowrap' }}>{fmt(v.mileage)}</td>
                                  <td style={{ padding:'10px 14px' }}><span style={{ padding:'2px 8px', borderRadius:10, fontSize:11, fontWeight:700, background:v.status==='active'?'#dcfce7':v.status==='maintenance'?'#fef3c7':'#fee2e2', color:v.status==='active'?'#15803d':v.status==='maintenance'?'#92400e':'#991b1b' }}>{v.status}</span></td>
                                  <td style={{ padding:'10px 14px' }} onClick={e=>e.stopPropagation()}>
                                    {canEdit&&<div style={{ display:'flex', gap:4 }}>
                                      <button onClick={()=>openEditV(v)} style={{ padding:'3px 8px', borderRadius:5, border:'1px solid #e5e7eb', background:'white', fontSize:11, cursor:'pointer' }}>Edit</button>
                                      <button onClick={()=>delV(v.id)} style={{ padding:'3px 8px', borderRadius:5, border:'none', background:'#fee2e2', color:'#dc2626', fontSize:11, cursor:'pointer' }}>Del</button>
                                    </div>}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )
                })}
              </div>
          }
        </>)}
      </div>

      {/* ── ASSET DETAIL PANEL ─────────────────────────────────────────────── */}
      {aDetail&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setADetail(null)}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ ...card, width:500, maxHeight:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'16px 20px', borderBottom:'1px solid #e5e7eb' }}>
              <div><div style={{ fontSize:16, fontWeight:700 }}>{aDetail.name}</div><div style={{ fontSize:11, color:'#6b7280', fontFamily:'monospace', marginTop:2 }}>{aDetail.asset_no} · {aDetail.company}</div></div>
              <button onClick={()=>setADetail(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9ca3af' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
                {[['Type',aDetail.type],['Status',aDetail.status],['Location',aDetail.location||'—'],['Department',aDetail.department||'—'],['Assigned To',aDetail.assigned_to||'—'],['Serial No',aDetail.serial_no||'—'],['Purchase Date',aDetail.purchase_date||'—'],['Purchase Cost',`${aDetail.currency} ${fmt(aDetail.purchase_cost)}`],['Current Value',`${aDetail.currency} ${fmt(aDetail.current_value)}`]].map(([k,v])=>(
                  <div key={k}><div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', fontWeight:700, marginBottom:2 }}>{k}</div><div style={{ fontSize:13, fontWeight:500 }}>{v}</div></div>
                ))}
              </div>
              {aDetail.notes&&<div style={{ padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:13, color:'#6b7280', marginBottom:16 }}>{aDetail.notes}</div>}
              <LogPanel logs={aLogs} logForm={aLogForm} setLogForm={setALogForm} showLog={aShowLog} setShowLog={setAShowLog} onSave={saveALog} saving={aSavingLog} />
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:8 }}>
              {canEdit&&<button onClick={()=>{openEditA(aDetail);setADetail(null)}} style={{ padding:'7px 16px', borderRadius:7, border:'1px solid #e5e7eb', background:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>Edit Asset</button>}
              <button onClick={()=>setADetail(null)} style={{ padding:'7px 16px', borderRadius:7, border:'none', background:'#f3f4f6', fontSize:13, cursor:'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VEHICLE DETAIL PANEL ───────────────────────────────────────────── */}
      {vDetail&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setVDetail(null)}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ ...card, width:520, maxHeight:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', padding:'16px 20px', borderBottom:'1px solid #e5e7eb' }}>
              <div><div style={{ fontSize:16, fontWeight:700 }}>🚗 {vDetail.reg_plate}</div><div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{vDetail.make} {vDetail.model}{vDetail.year?` (${vDetail.year})`:''} · {vDetail.company}</div></div>
              <button onClick={()=>setVDetail(null)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9ca3af' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              {/* Compliance grid */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:8 }}>Compliance & Expiry</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[{label:'Insurance',val:vDetail.insurance_expiry},{label:'Inspection/TLB',val:vDetail.inspection_expiry},{label:'Road License',val:vDetail.road_license_expiry},{label:'Driver License',val:vDetail.driver_license_expiry},{label:'PSV License',val:vDetail.psv_license_expiry},{label:'Service Due',val:vDetail.service_due_date}].map(({label,val})=>{
                    const days=daysUntil(val??null)
                    const exp=days!==null&&days<0; const soon=days!==null&&days>=0&&days<=30
                    return(
                      <div key={label} style={{ padding:'8px 10px', borderRadius:8, border:`1px solid ${exp?'#fecaca':soon?'#fde68a':'#e5e7eb'}`, background:exp?'#fff5f5':soon?'#fffbeb':'#f9fafb' }}>
                        <div style={{ fontSize:10, color:'#6b7280', fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>{label}</div>
                        <div style={{ fontSize:13, fontWeight:600, color:exp?'#dc2626':soon?'#b45309':'#111827' }}>
                          {val||'—'}{exp&&' EXPIRED'}{soon&&` (${days}d left)`}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
                {[['Driver',vDetail.assigned_driver||'—'],['Fuel',vDetail.fuel_type],['Mileage',`${fmt(vDetail.mileage)} km`],['Service KM',vDetail.service_due_km?`${fmt(vDetail.service_due_km)} km`:'—'],['Status',vDetail.status]].map(([k,v])=>(
                  <div key={k}><div style={{ fontSize:10, color:'#6b7280', textTransform:'uppercase', fontWeight:700, marginBottom:2 }}>{k}</div><div style={{ fontSize:13, fontWeight:500 }}>{v}</div></div>
                ))}
              </div>
              {vDetail.notes&&<div style={{ padding:'10px 14px', background:'#f9fafb', borderRadius:8, fontSize:13, color:'#6b7280', marginBottom:16 }}>{vDetail.notes}</div>}
              <LogPanel logs={vLogs} logForm={vLogForm} setLogForm={setVLogForm} showLog={vShowLog} setShowLog={setVShowLog} onSave={saveVLog} saving={vSavingLog} />
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:8 }}>
              {canEdit&&<button onClick={()=>{openEditV(vDetail);setVDetail(null)}} style={{ padding:'7px 16px', borderRadius:7, border:'1px solid #e5e7eb', background:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>Edit Vehicle</button>}
              <button onClick={()=>setVDetail(null)} style={{ padding:'7px 16px', borderRadius:7, border:'none', background:'#f3f4f6', fontSize:13, cursor:'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── ASSET FORM MODAL ───────────────────────────────────────────────── */}
      {aShowForm&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setAShowForm(false)}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ ...card, width:640, maxHeight:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #e5e7eb' }}>
              <span style={{ fontSize:16, fontWeight:700 }}>{aEditing?'Edit Asset':'Add Asset'}</span>
              <button onClick={()=>setAShowForm(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9ca3af' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[{k:'asset_no',l:'Asset No *',ph:'e.g. USM-EQ-001'},{k:'name',l:'Name *',ph:'Asset name'}].map(({k,l,ph})=>(
                  <div key={k}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{l}</label><input value={(aForm as Record<string,unknown>)[k] as string||''} onChange={e=>setAForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                ))}
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Type *</label><select value={aForm.type||'Equipment'} onChange={e=>setAForm(f=>({...f,type:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}>{ASSET_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Company *</label><select value={aForm.company||''} onChange={e=>setAForm(f=>({...f,company:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}><option value="">Select…</option>{COMPANIES.map(c=><option key={c}>{c}</option>)}</select></div>
                {[{k:'location',l:'Location',ph:'e.g. Mombasa Office'},{k:'department',l:'Department',ph:'e.g. Operations'},{k:'assigned_to',l:'Assigned To',ph:'Employee name'},{k:'serial_no',l:'Serial No',ph:'Manufacturer serial'}].map(({k,l,ph})=>(
                  <div key={k}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{l}</label><input value={(aForm as Record<string,unknown>)[k] as string||''} onChange={e=>setAForm(f=>({...f,[k]:e.target.value}))} placeholder={ph} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                ))}
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Purchase Date</label><input type="date" value={aForm.purchase_date||''} onChange={e=>setAForm(f=>({...f,purchase_date:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Currency</label><select value={aForm.currency||'KES'} onChange={e=>setAForm(f=>({...f,currency:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}>{CURRENCIES.map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Purchase Cost</label><input type="number" min="0" step="0.01" value={aForm.purchase_cost||0} onChange={e=>setAForm(f=>({...f,purchase_cost:Number(e.target.value)}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Current Value</label><input type="number" min="0" step="0.01" value={aForm.current_value||0} onChange={e=>setAForm(f=>({...f,current_value:Number(e.target.value)}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Status</label><select value={aForm.status||'active'} onChange={e=>setAForm(f=>({...f,status:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}>{STATUSES_A.map(s=><option key={s}>{s}</option>)}</select></div>
                <div style={{ gridColumn:'1/-1' }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Notes</label><textarea value={aForm.notes||''} onChange={e=>setAForm(f=>({...f,notes:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13, minHeight:60, resize:'vertical' }} /></div>
              </div>
              {aError&&<div style={{ color:'#dc2626', fontSize:13, marginTop:12 }}>{aError}</div>}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setAShowForm(false)} style={{ padding:'7px 16px', borderRadius:7, border:'1px solid #e5e7eb', background:'white', fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveA} disabled={aSaving} style={{ padding:'7px 16px', borderRadius:7, border:'none', background:'#15803d', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>{aSaving?'Saving…':aEditing?'Save Changes':'Add Asset'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VEHICLE FORM MODAL ─────────────────────────────────────────────── */}
      {vShowForm&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setVShowForm(false)}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ ...card, width:660, maxHeight:'calc(100vh - 80px)', display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #e5e7eb' }}>
              <span style={{ fontSize:16, fontWeight:700 }}>{vEditing?'Edit Vehicle':'Add Vehicle'}</span>
              <button onClick={()=>setVShowForm(false)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'#9ca3af' }}>✕</button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Plate *</label><input value={vForm.reg_plate||''} onChange={e=>setVForm(f=>({...f,reg_plate:e.target.value.toUpperCase()}))} placeholder="e.g. KBZ 123A" style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Company *</label><select value={vForm.company||''} onChange={e=>setVForm(f=>({...f,company:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}><option value="">Select…</option>{COMPANIES.map(c=><option key={c}>{c}</option>)}</select></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Make *</label><input value={vForm.make||''} onChange={e=>setVForm(f=>({...f,make:e.target.value}))} placeholder="Toyota" style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Model</label><input value={vForm.model||''} onChange={e=>setVForm(f=>({...f,model:e.target.value}))} placeholder="Land Cruiser" style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Year</label><input type="number" min="1990" max="2030" value={vForm.year||''} onChange={e=>setVForm(f=>({...f,year:Number(e.target.value)}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Fuel Type</label><select value={vForm.fuel_type||'Diesel'} onChange={e=>setVForm(f=>({...f,fuel_type:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}>{FUEL_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Assigned Driver</label><input value={vForm.assigned_driver||''} onChange={e=>setVForm(f=>({...f,assigned_driver:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Mileage (km)</label><input type="number" min="0" value={vForm.mileage||0} onChange={e=>setVForm(f=>({...f,mileage:Number(e.target.value)}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Status</label><select value={vForm.status||'active'} onChange={e=>setVForm(f=>({...f,status:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }}>{STATUSES_V.map(s=><option key={s}>{s}</option>)}</select></div>
                <div><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Service Due (km)</label><input type="number" min="0" value={vForm.service_due_km||0} onChange={e=>setVForm(f=>({...f,service_due_km:Number(e.target.value)}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
              </div>
              <div style={{ margin:'16px 0 8px', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px' }}>Compliance & Expiry Dates</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {[{k:'insurance_expiry',l:'Insurance'},{k:'inspection_expiry',l:'Inspection / TLB'},{k:'road_license_expiry',l:'Road License'},{k:'driver_license_expiry',l:'Driver License'},{k:'psv_license_expiry',l:'PSV License'},{k:'service_due_date',l:'Service Due Date'}].map(({k,l})=>(
                  <div key={k}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{l}</label><input type="date" value={(vForm as Record<string,unknown>)[k] as string||''} onChange={e=>setVForm(f=>({...f,[k]:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13 }} /></div>
                ))}
              </div>
              <div style={{ marginTop:12 }}><label style={{ display:'block', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>Notes</label><textarea value={vForm.notes||''} onChange={e=>setVForm(f=>({...f,notes:e.target.value}))} style={{ width:'100%', padding:'8px 10px', border:'1px solid #e5e7eb', borderRadius:6, fontSize:13, minHeight:56, resize:'vertical' }} /></div>
              {vError&&<div style={{ color:'#dc2626', fontSize:13, marginTop:12 }}>{vError}</div>}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid #e5e7eb', display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button onClick={()=>setVShowForm(false)} style={{ padding:'7px 16px', borderRadius:7, border:'1px solid #e5e7eb', background:'white', fontSize:13, cursor:'pointer' }}>Cancel</button>
              <button onClick={saveV} disabled={vSaving} style={{ padding:'7px 16px', borderRadius:7, border:'none', background:'#15803d', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>{vSaving?'Saving…':vEditing?'Save Changes':'Add Vehicle'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
