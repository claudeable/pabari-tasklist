'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'
import { LeaveRequest, LeaveStatus, LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, ANNUAL_LEAVE_LIMIT } from '@/lib/leaveTypes'

interface Props {
  currentUser: SessionUser
  requests:    LeaveRequest[]
  usedDays:    number
  remaining:   number
}

type Tab = 'mine' | 'pending_hr' | 'pending_hk' | 'all'

const STATUS_STYLE: Record<LeaveStatus, { bg: string; color: string }> = {
  pending_hr:  { bg: '#fef3c7', color: '#92400e' },
  pending_hk:  { bg: '#ede9fe', color: '#5b21b6' },
  approved:    { bg: '#d1fae5', color: '#065f46' },
  rejected:    { bg: '#fee2e2', color: '#991b1b' },
}

export default function LeaveList({ currentUser, requests: initialRequests, usedDays, remaining }: Props) {
  const [isMobile,       setIsMobile]       = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [requests,       setRequests]       = useState<LeaveRequest[]>(initialRequests)
  const [activeTab,      setActiveTab]      = useState<Tab>('mine')
  const [expandedId,     setExpandedId]     = useState<number | null>(null)
  const [modal,          setModal]          = useState<{ id: number; action: 'hr_approve' | 'hk_approve' | 'reject' } | null>(null)
  const [modalNotes,     setModalNotes]     = useState('')
  const [saving,         setSaving]         = useState(false)

  const isHR    = currentUser.department === 'HR' || currentUser.role === 'admin'
  const isAdmin = currentUser.role === 'admin'
  const canSeeAll = currentUser.role === 'admin' || currentUser.role === 'director' || currentUser.department === 'HR'

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const myRequests     = requests.filter(r => r.employee_id === Number(currentUser.id))
  const pendingHR      = requests.filter(r => r.status === 'pending_hr')
  const pendingHK      = requests.filter(r => r.status === 'pending_hk')

  const tabItems: { key: Tab; label: string; count: number; visible: boolean }[] = [
    { key: 'mine',       label: 'My Requests',       count: myRequests.length,  visible: true },
    { key: 'pending_hr', label: 'Pending HR Review',  count: pendingHR.length,   visible: isHR },
    { key: 'pending_hk', label: 'Pending HK Approval',count: pendingHK.length,   visible: isAdmin },
    { key: 'all',        label: 'All Requests',       count: requests.length,    visible: canSeeAll },
  ]

  const displayed = activeTab === 'mine'       ? myRequests
                  : activeTab === 'pending_hr' ? pendingHR
                  : activeTab === 'pending_hk' ? pendingHK
                  : requests

  async function handleAction() {
    if (!modal) return
    setSaving(true)
    try {
      const res = await fetch(`/api/forms/leave/${modal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: modal.action, notes: modalNotes }),
      })
      if (!res.ok) { alert('Failed. Please try again.'); return }
      const newStatus: LeaveStatus =
        modal.action === 'hr_approve'  ? 'pending_hk' :
        modal.action === 'hk_approve'  ? 'approved'   : 'rejected'
      setRequests(prev => prev.map(r => r.id === modal.id
        ? { ...r, status: newStatus, hr_notes: modal.action === 'hr_approve' ? modalNotes : r.hr_notes,
            hk_notes: modal.action === 'hk_approve' ? modalNotes : r.hk_notes,
            rejection_reason: modal.action === 'reject' ? modalNotes : r.rejection_reason }
        : r
      ))
      setModal(null)
      setModalNotes('')
      setExpandedId(null)
    } catch { alert('Network error.') }
    finally  { setSaving(false) }
  }

  function fmtDate(d: string) {
    if (!d) return ''
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
  }

  function signOut() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' })
  }

  const initials = currentUser.name.split(/[\s&./]+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)

  return (
    <div style={{minHeight:'100vh',background:'#f3f4f6',display:'flex',flexDirection:'column'}}>
      {/* NAV */}
      <div style={{background:'#1a3a2a',padding:'0 14px',display:'flex',alignItems:'center',gap:isMobile?8:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        {!isMobile && <>
          <span style={{fontSize:13,fontWeight:700,color:'white'}}>PABARI GROUP</span>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
          <a href="/" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>← Portal</a>
          <div style={{width:1,height:14,background:'rgba(255,255,255,0.2)',margin:'0 2px'}}/>
          <a href="/forms/leave" style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>Leave Requests</a>
          <a href="/forms/petty-cash" style={{color:'rgba(255,255,255,0.75)',textDecoration:'none',fontSize:12}}>Petty Cash</a>
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

      {/* MOBILE MENU */}
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
            ].map(item => (
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

      <div style={{flex:1,maxWidth:1000,margin:'0 auto',width:'100%',padding: isMobile ? '16px 12px' : '24px 20px'}}>
        {/* Page header */}
        <div style={{display:'flex',alignItems: isMobile ? 'flex-start' : 'center',justifyContent:'space-between',marginBottom:20,flexDirection: isMobile ? 'column' : 'row',gap:12}}>
          <div>
            <div style={{fontSize:20,fontWeight:700,color:'#1a3a2a'}}>Leave Requests</div>
            <div style={{fontSize:13,color:'#6b7280',marginTop:2}}>Manage leave applications and approvals</div>
          </div>
          <a href="/forms/leave/new"
            style={{background:'#1a3a2a',color:'white',padding:'9px 18px',borderRadius:6,textDecoration:'none',fontSize:13,fontWeight:600,display:'inline-flex',alignItems:'center',gap:6,alignSelf: isMobile ? 'flex-start' : 'auto'}}>
            + New Leave Request
          </a>
        </div>

        {/* My balance card */}
        <div style={{background:'white',borderRadius:8,padding:'14px 20px',marginBottom:16,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
          <div style={{fontSize:13,color:'#374151',fontWeight:600}}>My Annual Leave Balance ({new Date().getFullYear()})</div>
          <div style={{flex:1,minWidth:120}}>
            <div style={{height:8,background:'#e5e7eb',borderRadius:4,overflow:'hidden'}}>
              <div style={{height:'100%',background: usedDays >= ANNUAL_LEAVE_LIMIT ? '#dc2626' : '#1a3a2a',borderRadius:4,width:`${Math.min(100,(usedDays/ANNUAL_LEAVE_LIMIT)*100)}%`}}/>
            </div>
          </div>
          <div style={{fontSize:13,fontWeight:700,color: remaining === 0 ? '#dc2626' : '#1a3a2a',whiteSpace:'nowrap'}}>
            {usedDays} used · {remaining} remaining
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,marginBottom:16,background:'white',padding:4,borderRadius:8,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',overflowX:'auto'}}>
          {tabItems.filter(t => t.visible).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                padding:'8px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:13,fontWeight:activeTab===tab.key?600:400,
                background: activeTab===tab.key ? '#1a3a2a' : 'transparent',
                color: activeTab===tab.key ? 'white' : '#6b7280',
                display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',
              }}>
              {tab.label}
              {tab.count > 0 && (
                <span style={{background: activeTab===tab.key ? 'rgba(255,255,255,0.25)' : '#e5e7eb',color: activeTab===tab.key?'white':'#374151',borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:700}}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {displayed.length === 0 ? (
          <div style={{background:'white',borderRadius:8,padding:'40px 20px',textAlign:'center',color:'#9ca3af',fontSize:14,boxShadow:'0 1px 4px rgba(0,0,0,0.06)'}}>
            No leave requests found.
            {activeTab === 'mine' && <div style={{marginTop:12}}><a href="/forms/leave/new" style={{color:'#1a3a2a',fontWeight:600,textDecoration:'none'}}>Submit your first request →</a></div>}
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {displayed.map(req => {
              const isExpanded = expandedId === req.id
              const st = STATUS_STYLE[req.status]
              const isMyReq = req.employee_id === Number(currentUser.id)
              const canHRAction  = isHR && req.status === 'pending_hr'
              const canHKAction  = isAdmin && req.status === 'pending_hk'

              return (
                <div key={req.id} style={{background:'white',borderRadius:8,boxShadow:'0 1px 4px rgba(0,0,0,0.06)',overflow:'hidden',border:'1px solid #f0f0f0'}}>
                  {/* Row */}
                  <div onClick={()=>setExpandedId(isExpanded ? null : req.id)}
                    style={{padding:'14px 18px',cursor:'pointer',display:'flex',alignItems: isMobile ? 'flex-start' : 'center',gap:12,flexWrap: isMobile ? 'wrap' : 'nowrap'}}>

                    {/* Status badge */}
                    <span style={{background:st.bg,color:st.color,fontSize:10,fontWeight:700,padding:'3px 9px',borderRadius:10,whiteSpace:'nowrap',flexShrink:0,textTransform:'uppercase',letterSpacing:'0.3px'}}>
                      {LEAVE_STATUS_LABELS[req.status]}
                    </span>

                    {/* Name + company (for HR/admin view) */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:14,fontWeight:600,color:'#111827',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {canSeeAll && !isMyReq ? `${req.employee_name} — ` : ''}{LEAVE_TYPE_LABELS[req.leave_type]}
                      </div>
                      <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>
                        {req.company} · {fmtDate(req.date_from)} to {fmtDate(req.date_to)} · {req.days_requested} day{req.days_requested!==1?'s':''}
                      </div>
                    </div>

                    {/* Submitted date */}
                    <div style={{fontSize:11,color:'#9ca3af',whiteSpace:'nowrap',flexShrink:0}}>
                      {fmtDate(req.submitted_at)}
                    </div>

                    <span style={{color:'#9ca3af',fontSize:12,flexShrink:0}}>{isExpanded ? '▲' : '▼'}</span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div style={{borderTop:'1px solid #f0f0f0',padding:'18px 20px',background:'#fafafa'}}>
                      <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)',gap:12,marginBottom:16}}>
                        <Detail label="Employee" value={req.employee_name} />
                        <Detail label="Department" value={req.department} />
                        <Detail label="Job Title" value={req.job_title || '—'} />
                        <Detail label="Employee No." value={req.employee_no || '—'} />
                        <Detail label="Company" value={req.company} />
                        <Detail label="Leave Type" value={LEAVE_TYPE_LABELS[req.leave_type]} />
                        <Detail label="From" value={fmtDate(req.date_from)} />
                        <Detail label="To" value={fmtDate(req.date_to)} />
                        <Detail label="Days Requested" value={String(req.days_requested)} />
                        <Detail label="Cover Person" value={req.cover_person || '—'} />
                        <Detail label="Telephone" value={req.telephone || '—'} />
                        <Detail label="Date of Employment" value={req.date_of_employment || '—'} />
                      </div>
                      {req.reason && (
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Reason</div>
                          <div style={{fontSize:13,color:'#374151',background:'white',padding:'8px 12px',borderRadius:5,border:'1px solid #e5e7eb'}}>{req.reason}</div>
                        </div>
                      )}

                      {/* HR notes */}
                      {req.hr_notes && (
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>HR Notes</div>
                          <div style={{fontSize:13,color:'#374151',background:'white',padding:'8px 12px',borderRadius:5,border:'1px solid #e5e7eb'}}>{req.hr_notes}</div>
                        </div>
                      )}
                      {req.hk_notes && (
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:11,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>HK Notes</div>
                          <div style={{fontSize:13,color:'#374151',background:'white',padding:'8px 12px',borderRadius:5,border:'1px solid #e5e7eb'}}>{req.hk_notes}</div>
                        </div>
                      )}
                      {req.rejection_reason && (
                        <div style={{marginBottom:12}}>
                          <div style={{fontSize:11,color:'#dc2626',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4}}>Rejection Reason</div>
                          <div style={{fontSize:13,color:'#dc2626',background:'#fef2f2',padding:'8px 12px',borderRadius:5,border:'1px solid #fca5a5'}}>{req.rejection_reason}</div>
                        </div>
                      )}

                      {/* Action buttons */}
                      {(canHRAction || canHKAction) && (
                        <div style={{display:'flex',gap:8,marginTop:4}}>
                          <button
                            onClick={() => { setModal({ id: req.id, action: canHKAction ? 'hk_approve' : 'hr_approve' }); setModalNotes('') }}
                            style={{background:'#1a3a2a',color:'white',border:'none',padding:'8px 18px',borderRadius:5,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                            Approve
                          </button>
                          <button
                            onClick={() => { setModal({ id: req.id, action: 'reject' }); setModalNotes('') }}
                            style={{background:'#dc2626',color:'white',border:'none',padding:'8px 18px',borderRadius:5,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* APPROVAL MODAL */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
          onClick={e=>{ if(e.target===e.currentTarget){ setModal(null); setModalNotes('') }}}>
          <div style={{background:'white',borderRadius:10,padding:'28px 32px',width:'100%',maxWidth:420,boxShadow:'0 8px 32px rgba(0,0,0,0.2)'}}>
            <div style={{fontSize:16,fontWeight:700,color: modal.action === 'reject' ? '#dc2626' : '#1a3a2a',marginBottom:8}}>
              {modal.action === 'reject' ? 'Reject Leave Request' : 'Approve Leave Request'}
            </div>
            <div style={{fontSize:13,color:'#6b7280',marginBottom:16}}>
              {modal.action === 'reject'
                ? 'Provide a reason for rejection (required).'
                : 'Add optional notes for this approval.'}
            </div>
            <textarea
              placeholder={modal.action === 'reject' ? 'Reason for rejection…' : 'Notes (optional)…'}
              value={modalNotes} onChange={e=>setModalNotes(e.target.value)}
              style={{width:'100%',border:'1px solid #d1d5db',borderRadius:6,padding:'8px 10px',fontSize:13,minHeight:80,resize:'vertical',boxSizing:'border-box',marginBottom:16}}
            />
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>{ setModal(null); setModalNotes('') }}
                style={{background:'#f3f4f6',color:'#374151',border:'none',padding:'8px 18px',borderRadius:5,fontSize:13,fontWeight:600,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={handleAction} disabled={saving || (modal.action === 'reject' && !modalNotes.trim())}
                style={{background: modal.action === 'reject' ? '#dc2626' : '#1a3a2a',color:'white',border:'none',padding:'8px 18px',borderRadius:5,fontSize:13,fontWeight:600,cursor: saving ? 'not-allowed' : 'pointer',opacity: (modal.action === 'reject' && !modalNotes.trim()) ? 0.5 : 1}}>
                {saving ? 'Processing…' : modal.action === 'reject' ? 'Confirm Reject' : 'Confirm Approve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{fontSize:10,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:2}}>{label}</div>
      <div style={{fontSize:13,color:'#111827',fontWeight:500}}>{value}</div>
    </div>
  )
}
