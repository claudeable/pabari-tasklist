'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import { LEAVE_COMPANIES, LEAVE_TYPE_LABELS, LeaveType, ANNUAL_LEAVE_LIMIT } from '@/lib/leave'

interface Props {
  currentUser: SessionUser
  usedDays:   number
  remaining:  number
}

export default function LeaveRequestForm({ currentUser, usedDays, remaining }: Props) {
  const [isMobile,       setIsMobile]       = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  const [company,       setCompany]       = useState('')
  const [leaveType,     setLeaveType]     = useState<LeaveType>('annual')
  const [dateFrom,      setDateFrom]      = useState('')
  const [dateTo,        setDateTo]        = useState('')
  const [reason,        setReason]        = useState('')
  const [coverPerson,   setCoverPerson]   = useState('')
  const [employeeNo,    setEmployeeNo]    = useState('')
  const [jobTitle,      setJobTitle]      = useState('')
  const [dateOfEmp,     setDateOfEmp]     = useState('')
  const [telephone,     setTelephone]     = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [success,       setSuccess]       = useState(false)

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
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!company)   { setError('Please select a company.'); return }
    if (!dateFrom)  { setError('Please select a start date.'); return }
    if (!dateTo)    { setError('Please select an end date.'); return }
    if (daysRequested <= 0) { setError('End date must be on or after start date.'); return }
    if (wouldExceed) { setError(`You only have ${remaining} annual leave day(s) remaining for ${new Date(dateFrom).getFullYear()}.`); return }

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
      <div style={{minHeight:'100vh',background:'#f9fafb',display:'flex',flexDirection:'column'}}>
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

  const inputStyle: React.CSSProperties = {
    width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'8px 10px',
    fontSize:13, color:'#111827', background:'white', boxSizing:'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4,
  }
  const sectionStyle: React.CSSProperties = {
    background:'white', borderRadius:8, padding:'20px 24px', marginBottom:16,
    boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
  }

  return (
    <div style={{minHeight:'100vh',background:'#f9fafb',display:'flex',flexDirection:'column'}}>
      <Nav currentUser={currentUser} isMobile={isMobile} showMobileMenu={showMobileMenu} setShowMobileMenu={setShowMobileMenu} />

      <div style={{flex:1,maxWidth:760,margin:'0 auto',width:'100%',padding: isMobile ? '16px 12px' : '24px 16px'}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:20}}>
          <a href="/forms/leave" style={{color:'#6b7280',textDecoration:'none',fontSize:13}}>← Leave Requests</a>
          <span style={{color:'#d1d5db'}}>/</span>
          <span style={{fontSize:13,color:'#111827',fontWeight:600}}>New Request</span>
        </div>

        <div style={{fontSize:20,fontWeight:700,color:'#1a3a2a',marginBottom:4}}>Leave Request Form</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:20}}>Submit your leave request for HR and management review.</div>

        {/* Annual leave balance bar */}
        <div style={{background:'white',borderRadius:8,padding:'14px 20px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{fontSize:13,color:'#374151',fontWeight:600}}>Annual Leave Balance ({new Date().getFullYear()})</div>
          <div style={{flex:1,minWidth:160}}>
            <div style={{height:8,background:'#e5e7eb',borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',background: usedDays >= ANNUAL_LEAVE_LIMIT ? '#dc2626' : '#1a3a2a',borderRadius:4,width:`${Math.min(100,(usedDays/ANNUAL_LEAVE_LIMIT)*100)}%`,transition:'width 0.3s'}}/>
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color: remaining === 0 ? '#dc2626' : '#1a3a2a',whiteSpace:'nowrap'}}>
            {remaining} / {ANNUAL_LEAVE_LIMIT} days remaining
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Employee info */}
          <div style={sectionStyle}>
            <div style={{fontSize:14,fontWeight:700,color:'#1a3a2a',marginBottom:16,paddingBottom:10,borderBottom:'1px solid #f0f0f0'}}>Employee Details</div>
            <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap:14}}>
              <div>
                <label style={labelStyle}>Employee Name</label>
                <input style={{...inputStyle,background:'#f9fafb',color:'#6b7280'}} value={currentUser.name} disabled />
              </div>
              <div>
                <label style={labelStyle}>Employee No.</label>
                <input style={inputStyle} placeholder="e.g. EMP-001" value={employeeNo} onChange={e=>setEmployeeNo(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Department</label>
                <input style={{...inputStyle,background:'#f9fafb',color:'#6b7280'}} value={currentUser.department} disabled />
              </div>
              <div>
                <label style={labelStyle}>Job Title</label>
                <input style={inputStyle} placeholder="e.g. IT Manager" value={jobTitle} onChange={e=>setJobTitle(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Date of Employment</label>
                <input style={inputStyle} type="date" value={dateOfEmp} onChange={e=>setDateOfEmp(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Telephone</label>
                <input style={inputStyle} placeholder="e.g. +254 700 000 000" value={telephone} onChange={e=>setTelephone(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Company */}
          <div style={sectionStyle}>
            <div style={{fontSize:14,fontWeight:700,color:'#1a3a2a',marginBottom:16,paddingBottom:10,borderBottom:'1px solid #f0f0f0'}}>Company</div>
            <label style={labelStyle}>Select your employing company <span style={{color:'#dc2626'}}>*</span></label>
            <select style={inputStyle} value={company} onChange={e=>setCompany(e.target.value)} required>
              <option value="">-- Select company --</option>
              {LEAVE_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Leave type & dates */}
          <div style={sectionStyle}>
            <div style={{fontSize:14,fontWeight:700,color:'#1a3a2a',marginBottom:16,paddingBottom:10,borderBottom:'1px solid #f0f0f0'}}>Leave Type & Date</div>

            <label style={labelStyle}>Leave Type <span style={{color:'#dc2626'}}>*</span></label>
            <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3,1fr)',gap:8,marginBottom:18}}>
              {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([type, label]) => (
                <label key={type} style={{
                  display:'flex',alignItems:'center',gap:8,padding:'10px 12px',
                  border:`2px solid ${leaveType===type ? '#1a3a2a' : '#e5e7eb'}`,
                  borderRadius:6,cursor:'pointer',fontSize:13,fontWeight:leaveType===type?600:400,
                  color:leaveType===type?'#1a3a2a':'#374151',background:leaveType===type?'#f0f4f1':'white',
                  transition:'all 0.15s',
                }}>
                  <input type="radio" name="leaveType" value={type} checked={leaveType===type}
                    onChange={()=>setLeaveType(type)} style={{accentColor:'#1a3a2a'}} />
                  {label}
                </label>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap:14,marginBottom:14}}>
              <div>
                <label style={labelStyle}>From <span style={{color:'#dc2626'}}>*</span></label>
                <input style={inputStyle} type="date" value={dateFrom}
                  onChange={e=>{setDateFrom(e.target.value); if(dateTo && dateTo < e.target.value) setDateTo(e.target.value)}}
                  required />
              </div>
              <div>
                <label style={labelStyle}>To <span style={{color:'#dc2626'}}>*</span></label>
                <input style={inputStyle} type="date" value={dateTo} min={dateFrom}
                  onChange={e=>setDateTo(e.target.value)} required />
              </div>
            </div>

            {daysRequested > 0 && (
              <div style={{
                padding:'12px 16px', borderRadius:6, marginBottom:14,
                background: wouldExceed ? '#fef2f2' : '#f0f4f1',
                border:`1px solid ${wouldExceed ? '#fca5a5' : '#bbddcc'}`,
              }}>
                <span style={{fontSize:13,fontWeight:600,color: wouldExceed ? '#dc2626' : '#1a3a2a'}}>
                  {daysRequested} day{daysRequested!==1?'s':''} requested
                  {isAnnual ? ` · ${fmtDate(dateFrom)} to ${fmtDate(dateTo)}` : ` (${fmtDate(dateFrom)} to ${fmtDate(dateTo)})`}
                </span>
                {isAnnual && wouldExceed && (
                  <div style={{fontSize:12,color:'#dc2626',marginTop:4}}>
                    This exceeds your remaining balance of {remaining} day{remaining!==1?'s':''}. Please adjust your dates.
                  </div>
                )}
              </div>
            )}

            <div style={{marginBottom:14}}>
              <label style={labelStyle}>Reason / Comments</label>
              <textarea style={{...inputStyle,minHeight:80,resize:'vertical'}} placeholder="Provide any relevant details..."
                value={reason} onChange={e=>setReason(e.target.value)} />
            </div>

            <div>
              <label style={labelStyle}>While on leave, my duties will be covered by</label>
              <input style={inputStyle} placeholder="Name of colleague who will cover" value={coverPerson} onChange={e=>setCoverPerson(e.target.value)} />
            </div>
          </div>

          {/* HR section (read-only display) */}
          {isAnnual && daysRequested > 0 && (
            <div style={{...sectionStyle,background:'#f9fafb'}}>
              <div style={{fontSize:14,fontWeight:700,color:'#374151',marginBottom:14}}>For HR Department Use (auto-calculated)</div>
              <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr',gap:12}}>
                <div style={{padding:'10px 14px',background:'white',borderRadius:6,border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:2}}>Current Balance</div>
                  <div style={{fontSize:18,fontWeight:700,color:'#1a3a2a'}}>{remaining} days</div>
                </div>
                <div style={{padding:'10px 14px',background:'white',borderRadius:6,border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:2}}>Requested</div>
                  <div style={{fontSize:18,fontWeight:700,color:'#b5833a'}}>{daysRequested} days</div>
                </div>
                <div style={{padding:'10px 14px',background:'white',borderRadius:6,border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:2}}>Remaining After</div>
                  <div style={{fontSize:18,fontWeight:700,color: wouldExceed ? '#dc2626' : '#1a3a2a'}}>
                    {Math.max(0, remaining - daysRequested)} days
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:6,padding:'12px 16px',marginBottom:16,fontSize:13,color:'#dc2626'}}>
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
        </form>
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
          {currentUser.role !== 'staff' && <a href="/dashboard" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Dashboard</a>}
          <a href="/tasks" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Task Board</a>
          <a href="/forms/leave" style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>Forms</a>
          {currentUser.role !== 'staff' && <a href="/reports" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Reports</a>}
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
              ...(currentUser.role !== 'staff' ? [{label:'Dashboard',href:'/dashboard'}] : []),
              {label:'Task Board',href:'/tasks'},
              {label:'Forms',href:'/forms/leave'},
              ...(currentUser.role !== 'staff' ? [{label:'Reports',href:'/reports'}] : []),
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
