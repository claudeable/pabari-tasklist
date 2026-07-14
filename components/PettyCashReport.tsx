'use client'
import { useState, useCallback } from 'react'
import type { SessionUser } from '@/types'
import { COMPANIES } from '@/types'
import { PETTY_CASH_STATUS_LABELS } from '@/lib/pettyCashTypes'
import type { PettyCashStatus } from '@/lib/pettyCashTypes'

const FULL_ACCESS_NAMES = ['krishna', 'krishina', 'andu', 'andergachew']

function canSeeAll(user: SessionUser) {
  if (user.role === 'admin') return true
  return FULL_ACCESS_NAMES.includes(user.name.toLowerCase().split(' ')[0])
}

const STATUS_COLOR: Record<PettyCashStatus, { bg: string; color: string }> = {
  pending_hos:     { bg: '#fef9c3', color: '#92400e' },
  pending_hod:     { bg: '#dbeafe', color: '#1d4ed8' },
  pending_finance: { bg: '#ede9fe', color: '#6d28d9' },
  approved:        { bg: '#dcfce7', color: '#15803d' },
  rejected:        { bg: '#fee2e2', color: '#dc2626' },
}

const PEOPLE_LIST = [
  'Ahmad','Andu','Ashok','Benson','Binal','Duncan','Duran','Eng. Suresh',
  'Harshil','Juma','Krishina','Lazarus','Lulie Aynalem Ewnetu','Mungai',
  'Paul','Pedro','Sabina','Simon','Yalelet','Yared',
]

function fmtDate(d: string) {
  if (!d) return '—'
  const s = String(d).slice(0,10)
  const dt = new Date(s + 'T00:00:00')
  if (isNaN(dt.getTime())) return s
  return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function fmtAmt(n: number) {
  return 'KES ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits:2 })
}

type Row = Record<string, unknown>

function downloadCSV(rows: Row[], filename: string) {
  const headers = ['Req No','Date','Employee','Company','Department','Items','Amount (KES)','Payment','Status']
  const data = rows.map(r => {
    const items = Array.isArray(r.items) ? (r.items as {description:string;amount:number}[]).map(i=>`${i.description} (${i.amount})`).join(' | ') : ''
    return [
      r.req_no, String(r.request_date||'').slice(0,10), r.employee_name,
      r.company, r.department, items, r.total_amount,
      r.payment_method, PETTY_CASH_STATUS_LABELS[r.status as PettyCashStatus] || r.status,
    ]
  })
  const csv = [headers, ...data].map(row =>
    row.map(cell => `"${String(cell ?? '').replace(/"/g,'""')}"`).join(',')
  ).join('\n')
  const blob = new Blob(['﻿' + csv], { type:'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function PrintReport({ rows, filters, onClose }: {
  rows: Row[]; filters: Record<string,string>; onClose: () => void
}) {
  const total = rows.reduce((s,r) => s + Number(r.total_amount||0), 0)
  const approved = rows.filter(r=>r.status==='approved').reduce((s,r)=>s+Number(r.total_amount||0),0)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:12, maxWidth:900, width:'100%', maxHeight:'92vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Toolbar */}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid #e5e7eb', background:'#f9fafb', borderRadius:'12px 12px 0 0' }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Petty Cash Report — {rows.length} records</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>window.print()} style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 16px', fontSize:12, cursor:'pointer', fontWeight:600 }}>🖨 Print / Save PDF</button>
            <button onClick={onClose} style={{ background:'#f3f4f6', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>✕ Close</button>
          </div>
        </div>

        {/* Report body */}
        <div id="pcr-print" style={{ padding:'32px 40px', fontFamily:'Georgia,serif', fontSize:12, color:'#1a1a1a' }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:24 }}>
            <div>
              <div style={{ fontSize:20, fontWeight:700, color:'#1a3a2a' }}>Pabari Group of Companies</div>
              <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>Petty Cash Requests Report</div>
            </div>
            <div style={{ textAlign:'right', fontSize:11, color:'#6b7280' }}>
              <div>Generated: {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}</div>
              {filters.date_from && <div>From: {fmtDate(filters.date_from)}</div>}
              {filters.date_to   && <div>To: {fmtDate(filters.date_to)}</div>}
              {filters.person    && <div>Employee: {filters.person}</div>}
              {filters.status    && <div>Status: {PETTY_CASH_STATUS_LABELS[filters.status as PettyCashStatus]||filters.status}</div>}
              {filters.company   && <div>Company: {filters.company}</div>}
            </div>
          </div>
          <div style={{ height:2, background:'linear-gradient(90deg,#1a3a2a,#2d6a4f)', marginBottom:20 }}/>

          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
            {[
              { label:'Total Requests', val: String(rows.length) },
              { label:'Total Amount',   val: fmtAmt(total) },
              { label:'Approved Total', val: fmtAmt(approved) },
            ].map(s=>(
              <div key={s.label} style={{ border:'1px solid #e5e7eb', borderRadius:6, padding:'10px 14px', textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#1a3a2a' }}>{s.val}</div>
              </div>
            ))}
          </div>

          {/* Table */}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead>
              <tr style={{ background:'#1a3a2a', color:'white' }}>
                {['Req No','Date','Employee','Company','Items','Amount','Payment','Status'].map(h=>(
                  <th key={h} style={{ padding:'7px 10px', textAlign:'left', fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', fontSize:10 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>{
                const items = Array.isArray(r.items) ? (r.items as {description:string}[]).map(it=>it.description).join(', ') : ''
                const sc = STATUS_COLOR[r.status as PettyCashStatus] || { bg:'#f3f4f6', color:'#6b7280' }
                return (
                  <tr key={String(r.id)} style={{ background: i%2===0?'white':'#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                    <td style={{ padding:'7px 10px', fontWeight:700, color:'#1a3a2a', whiteSpace:'nowrap' }}>{String(r.req_no||`#${r.id}`)}</td>
                    <td style={{ padding:'7px 10px', whiteSpace:'nowrap', color:'#6b7280' }}>{fmtDate(String(r.request_date||''))}</td>
                    <td style={{ padding:'7px 10px', fontWeight:600 }}>{String(r.employee_name||'')}</td>
                    <td style={{ padding:'7px 10px', color:'#6b7280', whiteSpace:'nowrap' }}>{String(r.company||'')}</td>
                    <td style={{ padding:'7px 10px', color:'#374151', maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{items}</td>
                    <td style={{ padding:'7px 10px', fontWeight:700, whiteSpace:'nowrap' }}>KES {Number(r.total_amount||0).toLocaleString('en-KE',{minimumFractionDigits:2})}</td>
                    <td style={{ padding:'7px 10px', color:'#6b7280', whiteSpace:'nowrap', textTransform:'capitalize' }}>{String(r.payment_method||'').replace('_',' ')}</td>
                    <td style={{ padding:'7px 10px', whiteSpace:'nowrap' }}>
                      <span style={{ background:sc.bg, color:sc.color, borderRadius:10, padding:'2px 8px', fontSize:10, fontWeight:700 }}>
                        {PETTY_CASH_STATUS_LABELS[r.status as PettyCashStatus]||String(r.status)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'#1a3a2a', color:'white' }}>
                <td colSpan={5} style={{ padding:'8px 10px', fontWeight:700, textAlign:'right' }}>TOTAL</td>
                <td style={{ padding:'8px 10px', fontWeight:800, fontSize:13 }}>KES {total.toLocaleString('en-KE',{minimumFractionDigits:2})}</td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          </table>

          <div style={{ borderTop:'1px solid #e5e7eb', marginTop:24, paddingTop:10, fontSize:10, color:'#9ca3af', textAlign:'center' }}>
            Pabari Group ERP · Confidential · {new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function PettyCashReport({ currentUser }: { currentUser: SessionUser }) {
  const fullAccess = canSeeAll(currentUser)

  const today  = new Date().toISOString().slice(0,10)
  const month0 = today.slice(0,7) + '-01'

  const [dateFrom, setDateFrom] = useState(month0)
  const [dateTo,   setDateTo]   = useState(today)
  const [person,   setPerson]   = useState('')
  const [status,   setStatus]   = useState('')
  const [company,  setCompany]  = useState('')

  const [rows,    setRows]    = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded,  setLoaded]  = useState(false)
  const [showPrint, setShowPrint] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo)   params.set('date_to',   dateTo)
    if (person)   params.set('person',    person)
    if (status)   params.set('status',    status)
    if (company)  params.set('company',   company)
    const res = await fetch(`/api/reports/petty-cash?${params}`, { credentials:'include' })
    const data = await res.json()
    setRows(Array.isArray(data.rows) ? data.rows : [])
    setLoaded(true)
    setLoading(false)
  }, [dateFrom, dateTo, person, status, company])

  const total    = rows.reduce((s,r)=>s+Number(r.total_amount||0),0)
  const approved = rows.filter(r=>r.status==='approved').reduce((s,r)=>s+Number(r.total_amount||0),0)
  const pending  = rows.filter(r=>r.status!=='approved'&&r.status!=='rejected').reduce((s,r)=>s+Number(r.total_amount||0),0)

  const inp = { border:'1px solid #e5e7eb', borderRadius:6, padding:'7px 10px', fontSize:13, background:'white' } as const
  const lbl = { display:'block', fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:3, textTransform:'uppercase' as const, letterSpacing:'0.04em' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* Nav */}
      <div style={{ height:56, background:'#1a3a2a', display:'flex', alignItems:'center', gap:12, padding:'0 16px', flexShrink:0, zIndex:50 }}>
        <span style={{ background:'#b5833a', color:'white', fontWeight:800, fontSize:11, padding:'4px 9px', borderRadius:4, letterSpacing:'1px' }}>PABARI</span>
        <span style={{ fontSize:13, fontWeight:700, color:'white' }}>PABARI GROUP</span>
        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.15)', margin:'0 4px' }}/>
        <a href="/"         style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none', fontSize:12 }}>← Portal</a>
        <a href="/tasks"    style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none', fontSize:12 }}>Task Board</a>
        <a href="/projects" style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none', fontSize:12 }}>Projects</a>
        <a href="/finance"  style={{ color:'rgba(255,255,255,0.6)', textDecoration:'none', fontSize:12 }}>Finance</a>
        <a href="/reports/petty-cash" style={{ color:'white', textDecoration:'none', fontSize:12, fontWeight:600, borderBottom:'2px solid #b5833a', paddingBottom:2 }}>PCR Reports</a>
        <div style={{ flex:1 }}/>
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.5)' }}>{currentUser.name}</span>
      </div>

      <div style={{ flex:1, overflowY:'auto', background:'#f9fafb' }}>
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'28px 24px' }}>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:20, fontWeight:800, color:'#111827' }}>
              {fullAccess ? 'Petty Cash Reports' : 'My PCR History'}
            </div>
            <div style={{ fontSize:13, color:'#6b7280', marginTop:3 }}>
              {fullAccess
                ? 'Filter and export all petty cash requests across the organisation'
                : 'Your petty cash request history — export as PDF or Excel'}
            </div>
          </div>

          {/* Filter panel */}
          <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:10, padding:'18px 20px', marginBottom:20, boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#374151', marginBottom:14 }}>Filters</div>
            <div style={{ display:'grid', gridTemplateColumns: fullAccess ? 'repeat(5,1fr)' : 'repeat(3,1fr)', gap:12, marginBottom:14 }}>
              <div>
                <label style={lbl}>From date</label>
                <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>To date</label>
                <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Status</label>
                <select value={status} onChange={e=>setStatus(e.target.value)} style={inp}>
                  <option value="">All statuses</option>
                  {(Object.keys(PETTY_CASH_STATUS_LABELS) as PettyCashStatus[]).map(s=>(
                    <option key={s} value={s}>{PETTY_CASH_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
              {fullAccess && (
                <>
                  <div>
                    <label style={lbl}>Employee</label>
                    <select value={person} onChange={e=>setPerson(e.target.value)} style={inp}>
                      <option value="">Everyone</option>
                      {PEOPLE_LIST.map(p=><option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={lbl}>Company</label>
                    <select value={company} onChange={e=>setCompany(e.target.value)} style={inp}>
                      <option value="">All companies</option>
                      {COMPANIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <button onClick={load} disabled={loading}
              style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:7, padding:'9px 24px', fontSize:13, fontWeight:700, cursor:'pointer', opacity:loading?0.7:1 }}>
              {loading ? 'Loading…' : '🔍 Run Report'}
            </button>
          </div>

          {/* Summary cards */}
          {loaded && rows.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 }}>
              {[
                { label:'Total Requests',  val: String(rows.length),  color:'#374151' },
                { label:'Total Amount',    val: fmtAmt(total),        color:'#1a3a2a' },
                { label:'Approved',        val: fmtAmt(approved),     color:'#15803d' },
                { label:'Pending',         val: fmtAmt(pending),      color:'#d97706' },
              ].map(s=>(
                <div key={s.label} style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:8, padding:'14px 16px', textAlign:'center', boxShadow:'0 1px 2px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>{s.label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:s.color }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}

          {/* Export buttons */}
          {loaded && rows.length > 0 && (
            <div style={{ display:'flex', gap:10, marginBottom:16, justifyContent:'flex-end' }}>
              <button onClick={()=>downloadCSV(rows, `pcr-report-${dateFrom}-to-${dateTo}.csv`)}
                style={{ background:'#15803d', color:'white', border:'none', borderRadius:7, padding:'8px 18px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                ⬇ Export Excel / CSV
              </button>
              <button onClick={()=>setShowPrint(true)}
                style={{ background:'#1d4ed8', color:'white', border:'none', borderRadius:7, padding:'8px 18px', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                🖨 Export PDF
              </button>
            </div>
          )}

          {/* Results table */}
          {loaded && rows.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 20px', color:'#9ca3af', fontSize:14 }}>
              No records found for the selected filters.
            </div>
          )}

          {rows.length > 0 && (
            <div style={{ background:'white', border:'1px solid #e5e7eb', borderRadius:10, overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:'#1a3a2a', color:'white' }}>
                      {['Req No','Date','Employee','Company','Items','Amount','Payment','Status'].map(h=>(
                        <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r,i)=>{
                      const items = Array.isArray(r.items)
                        ? (r.items as {description:string;amount:number}[]).map(it=>it.description).join(', ')
                        : ''
                      const sc = STATUS_COLOR[r.status as PettyCashStatus] || { bg:'#f3f4f6', color:'#6b7280' }
                      return (
                        <tr key={String(r.id)} style={{ borderBottom:'1px solid #f3f4f6', background: i%2===0?'white':'#fafafa' }}>
                          <td style={{ padding:'10px 12px', fontWeight:700, color:'#1a3a2a', whiteSpace:'nowrap' }}>{String(r.req_no||`#${r.id}`)}</td>
                          <td style={{ padding:'10px 12px', whiteSpace:'nowrap', color:'#6b7280' }}>{fmtDate(String(r.request_date||''))}</td>
                          <td style={{ padding:'10px 12px', fontWeight:600, color:'#111827' }}>{String(r.employee_name||'')}</td>
                          <td style={{ padding:'10px 12px', color:'#6b7280', whiteSpace:'nowrap' }}>{String(r.company||'')}</td>
                          <td style={{ padding:'10px 12px', color:'#374151', maxWidth:260, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={items}>{items}</td>
                          <td style={{ padding:'10px 12px', fontWeight:700, whiteSpace:'nowrap', color:'#111827' }}>KES {Number(r.total_amount||0).toLocaleString('en-KE',{minimumFractionDigits:2})}</td>
                          <td style={{ padding:'10px 12px', color:'#6b7280', whiteSpace:'nowrap', textTransform:'capitalize' }}>{String(r.payment_method||'').replace('_',' ')}</td>
                          <td style={{ padding:'10px 12px', whiteSpace:'nowrap' }}>
                            <span style={{ background:sc.bg, color:sc.color, borderRadius:12, padding:'3px 10px', fontSize:11, fontWeight:700 }}>
                              {PETTY_CASH_STATUS_LABELS[r.status as PettyCashStatus]||String(r.status)}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#f9fafb', borderTop:'2px solid #e5e7eb' }}>
                      <td colSpan={5} style={{ padding:'10px 12px', fontWeight:700, color:'#374151', textAlign:'right', fontSize:13 }}>Total ({rows.length} requests)</td>
                      <td style={{ padding:'10px 12px', fontWeight:800, color:'#1a3a2a', fontSize:14 }}>KES {total.toLocaleString('en-KE',{minimumFractionDigits:2})}</td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {showPrint && (
        <PrintReport
          rows={rows}
          filters={{ date_from:dateFrom, date_to:dateTo, person, status, company }}
          onClose={()=>setShowPrint(false)}
        />
      )}
    </div>
  )
}
