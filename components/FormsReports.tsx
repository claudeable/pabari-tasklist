'use client'

import { useState, useEffect, useMemo } from 'react'
import { SessionUser } from '@/types'
import { LeaveRequest, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LeaveStatus, LeaveType } from '@/lib/leaveTypes'
import { PettyCashRequest, PettyCashStatus, PETTY_CASH_STATUS_LABELS } from '@/lib/pettyCashTypes'

interface Props {
  currentUser:   SessionUser
  leaveReqs:     LeaveRequest[]
  pcrReqs:       PettyCashRequest[]
  canSeeLeaveFull: boolean
  canSeePCRFull:   boolean
}

type ReportTab = 'leave' | 'pcr'

function fmtDate(d: string) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}
function fmtAmt(n: number) {
  return 'KSH ' + n.toLocaleString('en-KE', { minimumFractionDigits:2, maximumFractionDigits:2 })
}

// ── CSV helpers ──────────────────────────────────────────────────────────────
function esc(v: unknown): string {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s
}
function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function buildLeaveCSV(rows: LeaveRequest[]): string[][] {
  const header = [
    'Submitted','Employee Name','Employee No.','Department','Company',
    'Leave Type','From','To','Days Requested','Reason','Cover Person',
    'Status','HR Notes','HK Notes','Rejection Reason',
  ]
  const data = rows.map(r => [
    fmtDate(r.submitted_at), r.employee_name, r.employee_no, r.department, r.company,
    LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type,
    fmtDate(r.date_from), fmtDate(r.date_to), String(r.days_requested),
    r.reason, r.cover_person, LEAVE_STATUS_LABELS[r.status] ?? r.status,
    r.hr_notes, r.hk_notes, r.rejection_reason,
  ])
  return [header, ...data]
}

function buildPCRCSV(rows: PettyCashRequest[]): string[][] {
  const header = [
    'Request No.','Submitted','Employee','Department','Company',
    'Form Type','Payment Method','Item Description','Total Amount (KSH)','Status',
  ]
  const data = rows.map(r => {
    const itemDesc = r.items.map(i => `${i.description} (${i.account_no}) KSH${i.amount}`).join(' | ')
    return [
      r.req_no, fmtDate(r.submitted_at), r.employee_name, r.department, r.company,
      r.form_type === 'kiscol' ? 'KISCOL' : 'General',
      r.payment_method,
      itemDesc,
      r.total_amount.toFixed(2),
      PETTY_CASH_STATUS_LABELS[r.status] ?? r.status,
    ]
  })
  return [header, ...data]
}

// ── Main component ───────────────────────────────────────────────────────────
export default function FormsReports({ currentUser, leaveReqs, pcrReqs, canSeeLeaveFull, canSeePCRFull }: Props) {
  const [isMobile,       setIsMobile]       = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [tab,            setTab]            = useState<ReportTab>(canSeeLeaveFull ? 'leave' : 'pcr')

  // Filters
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [filterStatus,setFilterStatus]= useState('')
  const [filterCo,    setFilterCo]    = useState('')
  const [filterType,  setFilterType]  = useState('')   // leave type only

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  function signOut() {
    fetch('/api/auth/logout', { method:'POST' }).then(() => { window.location.href = '/login' })
  }

  // ── Filtered datasets ────────────────────────────────────────────────────
  const filteredLeave = useMemo(() => leaveReqs.filter(r => {
    if (dateFrom && r.submitted_at.slice(0,10) < dateFrom) return false
    if (dateTo   && r.submitted_at.slice(0,10) > dateTo)   return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterCo     && r.company !== filterCo)    return false
    if (filterType   && r.leave_type !== filterType) return false
    return true
  }), [leaveReqs, dateFrom, dateTo, filterStatus, filterCo, filterType])

  const filteredPCR = useMemo(() => pcrReqs.filter(r => {
    const sub = r.submitted_at.slice(0,10)
    if (dateFrom && sub < dateFrom)               return false
    if (dateTo   && sub > dateTo)                 return false
    if (filterStatus && r.status !== filterStatus) return false
    if (filterCo     && r.company !== filterCo)    return false
    return true
  }), [pcrReqs, dateFrom, dateTo, filterStatus, filterCo])

  // Summary stats
  const leaveTotalDays = filteredLeave.reduce((s,r) => s + r.days_requested, 0)
  const pcrTotalAmt    = filteredPCR.reduce((s,r) => s + r.total_amount, 0)

  // Unique company lists for filters
  const leaveCompanies = useMemo(() => Array.from(new Set(leaveReqs.map(r=>r.company))).sort(), [leaveReqs])
  const pcrCompanies   = useMemo(() => Array.from(new Set(pcrReqs.map(r=>r.company))).sort(), [pcrReqs])

  const leaveStatuses: LeaveStatus[] = ['pending_hr','pending_hk','approved','rejected']
  const pcrStatuses:   PettyCashStatus[] = ['pending_hos','pending_hod','pending_finance','approved','rejected']
  const leaveTypes     = Object.keys(LEAVE_TYPE_LABELS) as LeaveType[]

  function resetFilters() {
    setDateFrom(''); setDateTo(''); setFilterStatus(''); setFilterCo(''); setFilterType('')
  }

  const pill = (active: boolean): React.CSSProperties => ({
    padding:'6px 14px', borderRadius:16, fontSize:12, fontWeight:600, cursor:'pointer', border:'none',
    background: active ? '#1a3a2a' : '#f3f4f6', color: active ? 'white' : '#374151',
  })
  const selStyle: React.CSSProperties = {
    border:'1px solid #d1d5db', borderRadius:5, padding:'6px 10px', fontSize:12, background:'white', color:'#374151',
  }

  const initials = currentUser.name.split(/[\s&./]+/).map((w:string)=>w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)

  const canReports = canSeeLeaveFull || canSeePCRFull

  // ── Nav link helper ──────────────────────────────────────────────────────
  const navLink = (label: string, href: string, active = false): React.CSSProperties => ({
    color: active ? 'white' : 'rgba(255,255,255,0.65)', textDecoration:'none', fontSize:12,
    fontWeight: active ? 600 : 400, borderBottom: active ? '2px solid #b5833a' : 'none', paddingBottom: active ? 2 : 0,
  })

  return (
    <div style={{minHeight:'100vh',background:'#f3f4f6',display:'flex',flexDirection:'column'}}>

      {/* NAV */}
      <div style={{background:'#1a3a2a',padding:'0 14px',display:'flex',alignItems:'center',gap:isMobile?8:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        {!isMobile && <>
          <span style={{fontSize:13,fontWeight:700,color:'white'}}>PABARI GROUP</span>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
          <a href="/" style={navLink('← Portal','/')}>← Portal</a>
          <div style={{width:1,height:14,background:'rgba(255,255,255,0.2)',margin:'0 2px'}}/>
          <a href="/forms/leave"     style={navLink('Leave','/forms/leave')}>Leave Requests</a>
          <a href="/forms/petty-cash" style={navLink('PCR','/forms/petty-cash')}>Petty Cash</a>
          {canReports && <a href="/forms/reports" style={navLink('Reports','/forms/reports',true)}>Reports</a>}
        </>}
        <div style={{flex:1}}/>
        {!isMobile && <>
          <span style={{fontSize:12,color:'rgba(255,255,255,0.7)',fontWeight:500}}>{currentUser.name}</span>
          <button onClick={signOut} style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.15)',padding:'5px 11px',borderRadius:5,fontSize:11,cursor:'pointer'}}>Sign Out</button>
        </>}
        {isMobile && <>
          <div style={{width:28,height:28,borderRadius:'50%',background:'#2d3436',color:'white',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>{initials}</div>
          <button onClick={()=>setShowMobileMenu(true)} style={{background:'none',border:'1px solid rgba(255,255,255,0.3)',color:'white',borderRadius:4,padding:'4px 9px',fontSize:17,cursor:'pointer',lineHeight:1}}>☰</button>
        </>}
      </div>

      {isMobile && showMobileMenu && (
        <div style={{position:'fixed',inset:0,zIndex:600,background:'rgba(0,0,0,0.6)'}} onClick={()=>setShowMobileMenu(false)}>
          <div style={{background:'#1a3a2a',width:'100%'}} onClick={e=>e.stopPropagation()}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,0.1)'}}>
              <div style={{color:'white',fontWeight:600,fontSize:14}}>{currentUser.name}</div>
              <button onClick={()=>setShowMobileMenu(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.7)',fontSize:22,cursor:'pointer'}}>✕</button>
            </div>
            {[
              {label:'← Portal',href:'/'},
              {label:'Leave Requests',href:'/forms/leave'},
              {label:'Petty Cash',href:'/forms/petty-cash'},
              ...(canReports ? [{label:'Reports',href:'/forms/reports'}] : []),
            ].map(item=>(
              <a key={item.href} href={item.href} style={{display:'block',padding:'13px 16px',color:'rgba(255,255,255,0.85)',textDecoration:'none',fontSize:14,fontWeight:500,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                {item.label}
              </a>
            ))}
            <div style={{padding:'10px 12px'}}>
              <button onClick={signOut} style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 14px',fontSize:13,textAlign:'left',cursor:'pointer',width:'100%'}}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div style={{flex:1,padding: isMobile ? '12px 10px' : '24px 20px',maxWidth:1100,margin:'0 auto',width:'100%'}}>

        <div style={{fontSize:20,fontWeight:700,color:'#1a3a2a',marginBottom:4}}>Forms Reports</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:20}}>Download filtered reports for leave and petty cash requests.</div>

        {/* Tab bar */}
        <div style={{display:'flex',gap:8,marginBottom:20}}>
          {canSeeLeaveFull && (
            <button style={pill(tab==='leave')} onClick={()=>{ setTab('leave'); resetFilters() }}>
              Leave Requests
            </button>
          )}
          {canSeePCRFull && (
            <button style={pill(tab==='pcr')} onClick={()=>{ setTab('pcr'); resetFilters() }}>
              Petty Cash Requests
            </button>
          )}
        </div>

        {/* Filter bar */}
        <div style={{background:'white',borderRadius:8,padding:'14px 18px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',display:'flex',flexWrap:'wrap',gap:10,alignItems:'flex-end'}}>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>FROM DATE</div>
            <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={selStyle} />
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>TO DATE</div>
            <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={selStyle} />
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>STATUS</div>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={selStyle}>
              <option value="">All Statuses</option>
              {(tab==='leave' ? leaveStatuses : pcrStatuses).map(s=>(
                <option key={s} value={s}>
                  {tab==='leave' ? LEAVE_STATUS_LABELS[s as LeaveStatus] : PETTY_CASH_STATUS_LABELS[s as PettyCashStatus]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>COMPANY</div>
            <select value={filterCo} onChange={e=>setFilterCo(e.target.value)} style={selStyle}>
              <option value="">All Companies</option>
              {(tab==='leave' ? leaveCompanies : pcrCompanies).map(c=>(
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {tab==='leave' && (
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#6b7280',marginBottom:3}}>LEAVE TYPE</div>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)} style={selStyle}>
                <option value="">All Types</option>
                {leaveTypes.map(t=><option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
          )}
          <button onClick={resetFilters}
            style={{background:'#f3f4f6',color:'#374151',border:'none',padding:'7px 14px',borderRadius:5,fontSize:12,cursor:'pointer',alignSelf:'flex-end'}}>
            Reset
          </button>
        </div>

        {/* Summary + Download row */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12,flexWrap:'wrap',gap:10}}>
          <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
            {tab==='leave' ? <>
              <Stat label="Total Requests" value={String(filteredLeave.length)} />
              <Stat label="Total Days" value={String(leaveTotalDays)} />
              <Stat label="Approved" value={String(filteredLeave.filter(r=>r.status==='approved').length)} color="#15803d" />
              <Stat label="Pending" value={String(filteredLeave.filter(r=>r.status!=='approved'&&r.status!=='rejected').length)} color="#b45309" />
              <Stat label="Rejected" value={String(filteredLeave.filter(r=>r.status==='rejected').length)} color="#b91c1c" />
            </> : <>
              <Stat label="Total Requests" value={String(filteredPCR.length)} />
              <Stat label="Total Amount" value={fmtAmt(pcrTotalAmt)} />
              <Stat label="Approved" value={String(filteredPCR.filter(r=>r.status==='approved').length)} color="#15803d" />
              <Stat label="Pending" value={String(filteredPCR.filter(r=>r.status!=='approved'&&r.status!=='rejected').length)} color="#b45309" />
              <Stat label="Rejected" value={String(filteredPCR.filter(r=>r.status==='rejected').length)} color="#b91c1c" />
            </>}
          </div>
          <button
            onClick={()=>{
              const now = new Date().toISOString().slice(0,10)
              if (tab==='leave') {
                downloadCSV(buildLeaveCSV(filteredLeave), `leave-report-${now}.csv`)
              } else {
                downloadCSV(buildPCRCSV(filteredPCR), `petty-cash-report-${now}.csv`)
              }
            }}
            style={{background:'#1a3a2a',color:'white',border:'none',padding:'9px 18px',borderRadius:6,fontSize:13,fontWeight:600,cursor:'pointer',display:'flex',alignItems:'center',gap:7}}>
            ⬇ Download CSV
          </button>
        </div>

        {/* Table */}
        <div style={{background:'white',borderRadius:8,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',overflowX:'auto'}}>
          {tab==='leave' ? (
            <LeaveTable rows={filteredLeave} />
          ) : (
            <PCRTable rows={filteredPCR} />
          )}
        </div>

      </div>
    </div>
  )
}

// ── Stat chip ────────────────────────────────────────────────────────────────
function Stat({ label, value, color='#1a3a2a' }: { label:string; value:string; color?:string }) {
  return (
    <div style={{background:'white',borderRadius:6,padding:'7px 14px',boxShadow:'0 1px 3px rgba(0,0,0,0.06)',minWidth:90}}>
      <div style={{fontSize:10,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px'}}>{label}</div>
      <div style={{fontSize:16,fontWeight:700,color}}>{value}</div>
    </div>
  )
}

// ── Leave table ──────────────────────────────────────────────────────────────
function LeaveTable({ rows }: { rows: LeaveRequest[] }) {
  const STATUS_STYLE: Record<LeaveStatus,{bg:string;color:string}> = {
    pending_hr: {bg:'#fef3c7',color:'#92400e'},
    pending_hk: {bg:'#ede9fe',color:'#5b21b6'},
    approved:   {bg:'#d1fae5',color:'#065f46'},
    rejected:   {bg:'#fee2e2',color:'#991b1b'},
  }
  const th: React.CSSProperties = {
    padding:'10px 14px', fontSize:11, fontWeight:700, color:'#6b7280',
    textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap',
    borderBottom:'1px solid #e5e7eb', background:'#f9fafb', textAlign:'left',
  }
  const td: React.CSSProperties = {
    padding:'10px 14px', fontSize:12, color:'#374151', borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap',
  }
  if (!rows.length) return <div style={{padding:32,textAlign:'center',color:'#9ca3af',fontSize:13}}>No records match the current filters.</div>
  return (
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead>
        <tr>
          {['Submitted','Employee','Dept','Company','Leave Type','From','To','Days','Status'].map(h=>(
            <th key={h} style={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r=>{
          const ss = STATUS_STYLE[r.status]
          return (
            <tr key={r.id} style={{background:'white'}}>
              <td style={td}>{fmtDate(r.submitted_at)}</td>
              <td style={td}><div style={{fontWeight:600}}>{r.employee_name}</div><div style={{fontSize:10,color:'#9ca3af'}}>{r.employee_no}</div></td>
              <td style={td}>{r.department}</td>
              <td style={td} title={r.company}>{r.company.length>20?r.company.slice(0,18)+'…':r.company}</td>
              <td style={td}>{LEAVE_TYPE_LABELS[r.leave_type]}</td>
              <td style={td}>{fmtDate(r.date_from)}</td>
              <td style={td}>{fmtDate(r.date_to)}</td>
              <td style={{...td,fontWeight:700,textAlign:'center'}}>{r.days_requested}</td>
              <td style={td}>
                <span style={{background:ss.bg,color:ss.color,padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                  {LEAVE_STATUS_LABELS[r.status]}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── PCR table ────────────────────────────────────────────────────────────────
function PCRTable({ rows }: { rows: PettyCashRequest[] }) {
  const STATUS_STYLE: Record<PettyCashStatus,{bg:string;color:string}> = {
    pending_hos:     {bg:'#fef3c7',color:'#92400e'},
    pending_hod:     {bg:'#ede9fe',color:'#5b21b6'},
    pending_finance: {bg:'#dbeafe',color:'#1e40af'},
    approved:        {bg:'#d1fae5',color:'#065f46'},
    rejected:        {bg:'#fee2e2',color:'#991b1b'},
  }
  const th: React.CSSProperties = {
    padding:'10px 14px', fontSize:11, fontWeight:700, color:'#6b7280',
    textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap',
    borderBottom:'1px solid #e5e7eb', background:'#f9fafb', textAlign:'left',
  }
  const td: React.CSSProperties = {
    padding:'10px 14px', fontSize:12, color:'#374151', borderBottom:'1px solid #f3f4f6', whiteSpace:'nowrap',
  }
  if (!rows.length) return <div style={{padding:32,textAlign:'center',color:'#9ca3af',fontSize:13}}>No records match the current filters.</div>
  return (
    <table style={{width:'100%',borderCollapse:'collapse'}}>
      <thead>
        <tr>
          {['Req No.','Submitted','Employee','Company','Type','Amount (KSH)','Status'].map(h=>(
            <th key={h} style={th}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(r=>{
          const ss = STATUS_STYLE[r.status]
          return (
            <tr key={r.id} style={{background:'white'}}>
              <td style={{...td,fontWeight:600,fontFamily:'monospace'}}>{r.req_no || '—'}</td>
              <td style={td}>{fmtDate(r.submitted_at)}</td>
              <td style={td}><div style={{fontWeight:600}}>{r.employee_name}</div><div style={{fontSize:10,color:'#9ca3af'}}>{r.department}</div></td>
              <td style={td} title={r.company}>{r.company.length>22?r.company.slice(0,20)+'…':r.company}</td>
              <td style={td}>{r.form_type==='kiscol'?'KISCOL':'General'}</td>
              <td style={{...td,fontWeight:700,textAlign:'right'}}>{r.total_amount.toLocaleString('en-KE',{minimumFractionDigits:2})}</td>
              <td style={td}>
                <span style={{background:ss.bg,color:ss.color,padding:'2px 8px',borderRadius:10,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>
                  {PETTY_CASH_STATUS_LABELS[r.status]}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
