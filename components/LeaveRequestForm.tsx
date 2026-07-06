'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import { LEAVE_COMPANIES, LEAVE_TYPE_LABELS, LeaveType, ANNUAL_LEAVE_LIMIT } from '@/lib/leaveTypes'

interface Props {
  currentUser: SessionUser
  usedDays:   number
  remaining:  number
}

// Calendar grid: given dateFrom/dateTo, return which day-numbers (1–31) are in range
function getSelectedDays(dateFrom: string, dateTo: string, month: number, year: number): Set<number> {
  const set = new Set<number>()
  if (!dateFrom || !dateTo) return set
  const from = new Date(dateFrom)
  const to   = new Date(dateTo)
  const cur  = new Date(from)
  while (cur <= to) {
    if (cur.getMonth() === month && cur.getFullYear() === year) {
      set.add(cur.getDate())
    }
    cur.setDate(cur.getDate() + 1)
  }
  return set
}

export default function LeaveRequestForm({ currentUser, usedDays, remaining }: Props) {
  const [isMobile,       setIsMobile]       = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const [company,     setCompany]     = useState('')
  const [leaveType,   setLeaveType]   = useState<LeaveType>('annual')
  const [dateFrom,    setDateFrom]    = useState('')
  const [dateTo,      setDateTo]      = useState('')
  const [reason,      setReason]      = useState('')
  const [coverPerson, setCoverPerson] = useState('')
  const [employeeNo,  setEmployeeNo]  = useState('')
  const [jobTitle,    setJobTitle]    = useState('')
  const [dateOfEmp,   setDateOfEmp]   = useState('')
  const [telephone,   setTelephone]   = useState('')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const calcDays = (): number => {
    if (!dateFrom || !dateTo) return 0
    const from = new Date(dateFrom)
    const to   = new Date(dateTo)
    if (to < from) return 0
    return Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1
  }

  const daysRequested = calcDays()
  const isAnnual      = leaveType === 'annual'
  const wouldExceed   = isAnnual && daysRequested > 0 && (usedDays + daysRequested) > ANNUAL_LEAVE_LIMIT

  function fmtDate(d: string) {
    if (!d) return ''
    return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!company)           { setError('Please select a company.'); return }
    if (!dateFrom)          { setError('Please select a start date.'); return }
    if (!dateTo)            { setError('Please select an end date.'); return }
    if (daysRequested <= 0) { setError('End date must be on or after start date.'); return }
    if (wouldExceed)        { setError(`You only have ${remaining} annual leave day(s) remaining.`); return }

    setSaving(true)
    try {
      const res = await fetch('/api/forms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company, leave_type: leaveType, date_from: dateFrom, date_to: dateTo,
          days_requested: daysRequested, reason, cover_person: coverPerson,
          employee_no: employeeNo, job_title: jobTitle,
          date_of_employment: dateOfEmp, telephone,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to submit.'); return }
      setSuccess(true)
    } catch { setError('Network error. Please try again.') }
    finally  { setSaving(false) }
  }

  if (success) {
    return (
      <div style={{minHeight:'100vh',background:'#f5f5f0',display:'flex',flexDirection:'column'}}>
        <Nav currentUser={currentUser} isMobile={isMobile} showMobileMenu={showMobileMenu} setShowMobileMenu={setShowMobileMenu} />
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'white',borderRadius:10,padding:'40px 48px',textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,0.08)',maxWidth:420}}>
            <div style={{fontSize:48,marginBottom:16}}>✓</div>
            <div style={{fontSize:20,fontWeight:700,color:'#1a3a2a',marginBottom:8}}>Leave Request Submitted</div>
            <p style={{color:'#6b7280',fontSize:14,marginBottom:24,lineHeight:1.6}}>
              Your request has been sent to HR for review. You will be notified once it is processed.
            </p>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <a href="/forms/leave/new" style={{background:'#1a3a2a',color:'white',padding:'10px 20px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:600}}>
                New Request
              </a>
              <a href="/forms/leave" style={{background:'#f3f4f6',color:'#374151',padding:'10px 20px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:600}}>
                View All Requests
              </a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Calendar: determine which month(s) to show based on dateFrom
  const calMonth = dateFrom ? new Date(dateFrom).getMonth() : new Date().getMonth()
  const calYear  = dateFrom ? new Date(dateFrom).getFullYear() : new Date().getFullYear()
  const selectedDays = getSelectedDays(dateFrom, dateTo, calMonth, calYear)
  const daysInMonth  = new Date(calYear, calMonth + 1, 0).getDate()
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  const inp: React.CSSProperties = {
    border:'none', borderBottom:'1px solid #999', outline:'none', background:'transparent',
    fontSize:13, color:'#111', padding:'2px 4px', width:'100%',
  }
  const dotLine: React.CSSProperties = {
    flex:1, borderBottom:'1px dotted #999', minWidth:40,
  }

  // Leave type grid: 2 rows × 3 cols matching the paper form
  const leftCol:  [LeaveType, string][] = [['annual','Annual Leave'],['sick','Sick Leave']]
  const midCol:   [LeaveType, string][] = [['maternity','Maternity Leave'],['paternity','Paternity Leave']]
  const rightCol: [LeaveType, string][] = [['compassionate','Compassionate Leave'],['absence','Leave Of Absence']]

  return (
    <div style={{minHeight:'100vh',background:'#f5f5f0',display:'flex',flexDirection:'column'}}>
      <Nav currentUser={currentUser} isMobile={isMobile} showMobileMenu={showMobileMenu} setShowMobileMenu={setShowMobileMenu} />

      <div style={{flex:1,padding: isMobile ? '12px 8px' : '24px 16px',display:'flex',justifyContent:'center'}}>
        <div style={{width:'100%',maxWidth:780}}>

          {/* Back breadcrumb */}
          <div style={{marginBottom:16,fontSize:13,color:'#6b7280'}}>
            <a href="/forms/leave" style={{color:'#6b7280',textDecoration:'none'}}>← Leave Requests</a>
            <span style={{margin:'0 8px',color:'#d1d5db'}}>/</span>
            <span style={{color:'#111827',fontWeight:600}}>New Request</span>
          </div>

          {/* Annual leave balance bar (only for annual) */}
          {isAnnual && (
            <div style={{background:'white',borderRadius:6,padding:'10px 16px',marginBottom:12,boxShadow:'0 1px 3px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
              <span style={{fontSize:12,color:'#374151',fontWeight:600,whiteSpace:'nowrap'}}>Annual Leave Balance {calYear}</span>
              <div style={{flex:1,minWidth:120,height:6,background:'#e5e7eb',borderRadius:3,overflow:'hidden'}}>
                <div style={{height:'100%',background: usedDays >= ANNUAL_LEAVE_LIMIT ? '#dc2626' : '#1a3a2a',borderRadius:3,width:`${Math.min(100,(usedDays/ANNUAL_LEAVE_LIMIT)*100)}%`}}/>
              </div>
              <span style={{fontSize:12,fontWeight:700,color: remaining===0 ? '#dc2626' : '#1a3a2a',whiteSpace:'nowrap'}}>
                {remaining} / {ANNUAL_LEAVE_LIMIT} days remaining
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* ── MAIN FORM DOCUMENT ── */}
            <div style={{background:'white',borderRadius:8,boxShadow:'0 2px 12px rgba(0,0,0,0.08)',overflow:'hidden'}}>

              {/* Document header */}
              <div style={{borderBottom:'2px solid #1a3a2a',padding: isMobile ? '20px 16px 14px' : '24px 32px 16px',textAlign:'center'}}>
                <div style={{fontSize: isMobile ? 16 : 20,fontWeight:800,letterSpacing:'2px',color:'#1a3a2a',textTransform:'uppercase'}}>
                  Leave Request Form
                </div>
                <div style={{fontSize:11,color:'#9ca3af',marginTop:2}}>Pabari Group of Companies</div>
              </div>

              <div style={{padding: isMobile ? '16px' : '24px 32px'}}>

                {/* Company */}
                <div style={{marginBottom:16}}>
                  <label style={{fontSize:12,fontWeight:600,color:'#374151',display:'block',marginBottom:4}}>
                    Company <span style={{color:'#dc2626'}}>*</span>
                  </label>
                  <select style={{border:'1px solid #d1d5db',borderRadius:4,padding:'7px 10px',fontSize:13,width:'100%',background:'white'}}
                    value={company} onChange={e=>setCompany(e.target.value)} required>
                    <option value="">-- Select company --</option>
                    {LEAVE_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                {/* Employee info: 3 rows × 2 cols */}
                <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap: isMobile ? 10 : '6px 32px',marginBottom:16}}>
                  <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                    <span style={{fontSize:12,whiteSpace:'nowrap',color:'#374151',fontWeight:500}}>Employee Name:</span>
                    <span style={{...dotLine}}/>
                    <span style={{fontSize:13,fontWeight:600,color:'#1a3a2a',whiteSpace:'nowrap'}}>{currentUser.name}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                    <span style={{fontSize:12,whiteSpace:'nowrap',color:'#374151',fontWeight:500}}>Employee No.:</span>
                    <span style={{...dotLine}}/>
                    <input style={{...inp,width:120}} placeholder="EMP-001" value={employeeNo} onChange={e=>setEmployeeNo(e.target.value)} />
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                    <span style={{fontSize:12,whiteSpace:'nowrap',color:'#374151',fontWeight:500}}>Department:</span>
                    <span style={{...dotLine}}/>
                    <span style={{fontSize:13,fontWeight:500,color:'#374151',whiteSpace:'nowrap'}}>{currentUser.department}</span>
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                    <span style={{fontSize:12,whiteSpace:'nowrap',color:'#374151',fontWeight:500}}>Job Title:</span>
                    <span style={{...dotLine}}/>
                    <input style={{...inp,width:140}} placeholder="e.g. Operations Manager" value={jobTitle} onChange={e=>setJobTitle(e.target.value)} />
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                    <span style={{fontSize:12,whiteSpace:'nowrap',color:'#374151',fontWeight:500}}>Date of Employment:</span>
                    <span style={{...dotLine}}/>
                    <input style={{...inp,width:120}} type="date" value={dateOfEmp} onChange={e=>setDateOfEmp(e.target.value)} />
                  </div>
                  <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                    <span style={{fontSize:12,whiteSpace:'nowrap',color:'#374151',fontWeight:500}}>Telephone No.:</span>
                    <span style={{...dotLine}}/>
                    <input style={{...inp,width:140}} placeholder="+254 700 000 000" value={telephone} onChange={e=>setTelephone(e.target.value)} />
                  </div>
                </div>

                {/* ── Leave Type & Date ── */}
                <div style={{border:'1px solid #d1d5db',borderRadius:4,padding: isMobile ? '12px' : '14px 20px',marginBottom:16}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#1a3a2a',marginBottom:12,textDecoration:'underline'}}>
                    Leave Type &amp; Date
                  </div>

                  {/* Leave type checkbox grid: 2 rows × 3 cols */}
                  <div style={{
                    display:'grid',
                    gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr',
                    gap:8,
                    marginBottom:14,
                  }}>
                    {([...leftCol, ...midCol, ...rightCol] as [LeaveType,string][]).map(([type, label]) => (
                      <label key={type} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'#111827'}}>
                        <div style={{
                          width:18, height:18, border:'2px solid #374151', borderRadius:2,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          background: leaveType===type ? '#1a3a2a' : 'white', flexShrink:0,
                        }}
                          onClick={()=>setLeaveType(type)}>
                          {leaveType===type && <span style={{color:'white',fontSize:12,lineHeight:1,fontWeight:700}}>✓</span>}
                        </div>
                        <input type="radio" name="leaveType" value={type} checked={leaveType===type}
                          onChange={()=>setLeaveType(type)} style={{display:'none'}} />
                        <span style={{fontWeight: leaveType===type ? 600 : 400}}>{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Requested dates */}
                  <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'#374151',fontWeight:500,whiteSpace:'nowrap'}}>Requested Date from:</span>
                    <input type="date" value={dateFrom}
                      onChange={e=>{setDateFrom(e.target.value); if(dateTo && dateTo < e.target.value) setDateTo(e.target.value)}}
                      style={{border:'none',borderBottom:'1px solid #999',outline:'none',background:'transparent',fontSize:13,padding:'2px 4px'}}
                      required />
                    <span style={{fontSize:12,color:'#374151',fontWeight:500}}>To:</span>
                    <input type="date" value={dateTo} min={dateFrom}
                      onChange={e=>setDateTo(e.target.value)}
                      style={{border:'none',borderBottom:'1px solid #999',outline:'none',background:'transparent',fontSize:13,padding:'2px 4px'}}
                      required />
                    {daysRequested > 0 && (
                      <span style={{
                        marginLeft:8, fontSize:12, fontWeight:700, padding:'2px 8px', borderRadius:10,
                        background: wouldExceed ? '#fef2f2' : '#f0f4f1',
                        color: wouldExceed ? '#dc2626' : '#1a3a2a',
                        border: `1px solid ${wouldExceed ? '#fca5a5' : '#bbddcc'}`,
                      }}>
                        {daysRequested} day{daysRequested!==1?'s':''}
                        {isAnnual && wouldExceed && ' — exceeds balance!'}
                      </span>
                    )}
                  </div>

                  {/* Reason */}
                  <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:10}}>
                    <span style={{fontSize:12,color:'#374151',fontWeight:500,whiteSpace:'nowrap',paddingTop:2}}>Reason / Comments:</span>
                    <textarea value={reason} onChange={e=>setReason(e.target.value)}
                      placeholder="Provide any relevant details..."
                      style={{flex:1,border:'none',borderBottom:'1px solid #999',outline:'none',background:'transparent',fontSize:13,padding:'2px 4px',resize:'vertical',minHeight:36,fontFamily:'inherit'}} />
                  </div>

                  {/* Cover person */}
                  <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:10,flexWrap:'wrap'}}>
                    <span style={{fontSize:12,color:'#374151',fontWeight:500}}>While on leave</span>
                    <input value={coverPerson} onChange={e=>setCoverPerson(e.target.value)}
                      placeholder="colleague's name"
                      style={{border:'none',borderBottom:'1px solid #999',outline:'none',background:'transparent',fontSize:13,padding:'2px 4px',minWidth:160,maxWidth:200}} />
                    <span style={{fontSize:12,color:'#374151',fontWeight:500}}>will relieve me / responsibly take up my duties</span>
                  </div>

                  {/* Calendar grid */}
                  {dateFrom && (
                    <div style={{marginTop:12,overflowX:'auto'}}>
                      <div style={{fontSize:11,color:'#6b7280',marginBottom:4,fontWeight:500}}>
                        Please tick Leave Days Required — {months[calMonth]} {calYear}
                      </div>
                      <table style={{borderCollapse:'collapse',width:'100%',minWidth:560}}>
                        <thead>
                          <tr>
                            <td style={{border:'1px solid #d1d5db',padding:'3px 6px',fontSize:10,fontWeight:700,color:'#374151',background:'#f9fafb',whiteSpace:'nowrap',width:52}}>Days /<br/>Month /<br/>Year</td>
                            {Array.from({length:31},(_,i)=>i+1).map(d=>(
                              <td key={d} style={{
                                border:'1px solid #d1d5db',padding:'4px 0',fontSize:10,fontWeight:600,
                                textAlign:'center',width:'calc((100% - 52px) / 31)',
                                background: d > daysInMonth ? '#f3f4f6' : 'white',
                                color: d > daysInMonth ? '#d1d5db' : '#374151',
                              }}>{d}</td>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{border:'1px solid #d1d5db',padding:'3px 6px',fontSize:10,color:'#6b7280',textAlign:'center'}}>
                              {months[calMonth]}<br/>{calYear}
                            </td>
                            {Array.from({length:31},(_,i)=>i+1).map(d=>(
                              <td key={d} style={{
                                border:'1px solid #d1d5db',padding:'6px 0',textAlign:'center',
                                background: selectedDays.has(d) ? '#1a3a2a' : d > daysInMonth ? '#f3f4f6' : 'white',
                              }}>
                                {selectedDays.has(d) && <span style={{color:'white',fontSize:10,fontWeight:700}}>✓</span>}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* ── For HR Department Use ── */}
                <div style={{border:'1px solid #d1d5db',borderRadius:4,padding: isMobile ? '12px' : '14px 20px',marginBottom:16,background:'#fafafa'}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:12,textDecoration:'underline'}}>
                    For HR Department Use
                  </div>
                  <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap:'8px 40px'}}>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {[
                        { label:'Current Leave Balance:', value: isAnnual ? `${remaining} Days` : '—', highlight: false },
                        { label:'Requested Days:',         value: daysRequested > 0 ? `${daysRequested} Days` : '—', highlight: false },
                        { label:'Remaining Balance:',      value: isAnnual && daysRequested > 0 ? `${Math.max(0, remaining - daysRequested)} Days` : '—', highlight: wouldExceed },
                      ].map(({label, value, highlight}) => (
                        <div key={label} style={{display:'flex',alignItems:'center',gap:8}}>
                          <span style={{fontSize:12,color:'#374151',minWidth:140}}>{label}</span>
                          <div style={{
                            border:'1px solid #d1d5db', borderRadius:2, padding:'3px 12px',
                            minWidth:60, textAlign:'center', background:'white',
                            fontSize:13, fontWeight:600, color: highlight ? '#dc2626' : '#1a3a2a',
                          }}>{value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:10}}>
                      <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                        <span style={{fontSize:12,color:'#374151',whiteSpace:'nowrap'}}>Reviewed by:</span>
                        <span style={{...dotLine}}/>
                      </div>
                      <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                        <span style={{fontSize:12,color:'#374151',whiteSpace:'nowrap'}}>Date:</span>
                        <span style={{...dotLine}}/>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Approvals ── */}
                <div style={{border:'1px solid #d1d5db',borderRadius:4,padding: isMobile ? '12px' : '14px 20px',marginBottom:20}}>
                  <div style={{fontSize:13,fontWeight:700,color:'#374151',marginBottom:12,textDecoration:'underline'}}>
                    Approvals
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {[
                      "Employee's name",
                      "Supervisor's name",
                      "HOD's name",
                      "HRM's name",
                      "Director Projects' name",
                    ].map((role, i) => (
                      <div key={i} style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '140px 1fr 100px 1fr 80px',gap:8,alignItems:'baseline'}}>
                        <span style={{fontSize:12,color:'#374151'}}>{role}:</span>
                        <span style={{...dotLine}}/>
                        <span style={{fontSize:12,color:'#374151',textAlign:'right',whiteSpace:'nowrap'}}>Signature:</span>
                        <span style={{...dotLine}}/>
                        <span style={{fontSize:11,color:'#9ca3af',textAlign:'right',whiteSpace:'nowrap'}}>Date: ______</span>
                      </div>
                    ))}
                  </div>
                  <div style={{marginTop:12,padding:'8px 10px',background:'#fffbeb',border:'1px solid #fde68a',borderRadius:4,fontSize:11,color:'#92400e',lineHeight:1.5}}>
                    Note: All outstanding leave and statutory holidays MUST be taken BEFORE any unpaid Leave Of Absence is taken (excluding Maternity Leave, Paternity Leave and Compassionate Leave).
                  </div>
                </div>

                {error && (
                  <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:6,padding:'10px 14px',marginBottom:14,fontSize:13,color:'#dc2626'}}>
                    {error}
                  </div>
                )}

                <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
                  <a href="/forms/leave" style={{background:'#f3f4f6',color:'#374151',padding:'10px 20px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:600,display:'inline-flex',alignItems:'center'}}>
                    Cancel
                  </a>
                  <button type="submit" disabled={saving || wouldExceed}
                    style={{background: wouldExceed ? '#9ca3af' : '#1a3a2a',color:'white',border:'none',padding:'10px 24px',borderRadius:6,fontSize:14,fontWeight:600,cursor: wouldExceed ? 'not-allowed' : 'pointer'}}>
                    {saving ? 'Submitting…' : 'Submit Leave Request'}
                  </button>
                </div>

              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// ── Shared Nav ───────────────────────────────────────────────────────────────
function Nav({ currentUser, isMobile, showMobileMenu, setShowMobileMenu }: {
  currentUser: SessionUser
  isMobile: boolean
  showMobileMenu: boolean
  setShowMobileMenu: (v: boolean) => void
}) {
  const initials = currentUser.name.split(/[\s&./]+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)

  function signOut() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' })
  }

  return (
    <>
      <div style={{background:'#1a3a2a',padding:'0 14px',display:'flex',alignItems:'center',gap: isMobile?8:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        {!isMobile && <>
          <span style={{fontSize:13,fontWeight:700,color:'white',letterSpacing:'0.2px'}}>PABARI GROUP</span>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
          <a href="/" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>← Portal</a>
          <div style={{width:1,height:14,background:'rgba(255,255,255,0.2)',margin:'0 2px'}}/>
          <a href="/forms/leave" style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>Leave Requests</a>
          <a href="/forms/petty-cash" style={{color:'rgba(255,255,255,0.75)',textDecoration:'none',fontSize:12}}>Petty Cash</a>
          {currentUser.role !== 'staff' && <a href="/forms/reports" style={{color:'rgba(255,255,255,0.75)',textDecoration:'none',fontSize:12}}>Reports</a>}
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
              ...(currentUser.role !== 'staff' ? [{label:'Reports',href:'/forms/reports'}] : []),
            ].map(item => (
              <a key={item.href} href={item.href} style={{display:'block',padding:'13px 16px',color:'rgba(255,255,255,0.85)',textDecoration:'none',fontSize:14,fontWeight:500,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
                {item.label}
              </a>
            ))}
            <div style={{padding:'10px 12px'}}>
              <button onClick={signOut} style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 14px',fontSize:13,textAlign:'left',cursor:'pointer',width:'100%'}}>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
