'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'

interface Props {
  currentUser: SessionUser
}

interface PendingCounts {
  leave: number
  pettyCashGeneral: number
  pettyCashKiscol: number
  total: number
}

export default function FormsLanding({ currentUser }: Props) {
  const [isMobile,       setIsMobile]       = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [pending,        setPending]        = useState<PendingCounts | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    fetch('/api/forms/pending-count')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setPending(d) })
      .catch(() => {})
  }, [])

  const hasKiscol = currentUser.companies.includes('ALL') || currentUser.companies.includes('KISCOL')
  const initials  = currentUser.name.split(/[\s&./]+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)

  function signOut() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' })
  }

  const forms = [
    {
      title:        'Leave Request Form',
      description:  'Submit annual, sick, maternity or compassionate leave. Requires HR and Harshil approval.',
      icon:         '📅',
      listHref:     '/forms/leave',
      newHref:      '/forms/leave/new',
      visible:      true,
      badge:        'Leave',
      badgeColor:   '#1a3a2a',
      pendingCount: pending?.leave ?? 0,
    },
    {
      title:        'Petty Cash Requisition (General)',
      description:  'For all other companies under Pabari Group. Approved by Krishna → HOD → Andu.',
      icon:         '💵',
      listHref:     '/forms/petty-cash',
      newHref:      '/forms/petty-cash/new',
      visible:      true,
      badge:        'General',
      badgeColor:   '#b5833a',
      pendingCount: pending?.pettyCashGeneral ?? 0,
    },
  ].filter(f => f.visible)

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
          <a href="/forms/leave" style={{color:'rgba(255,255,255,0.75)',textDecoration:'none',fontSize:12}}>Leave Requests</a>
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
              <button onClick={signOut} style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 14px',fontSize:13,textAlign:'left',cursor:'pointer',width:'100%'}}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={{flex:1,maxWidth:900,margin:'0 auto',width:'100%',padding: isMobile ? '20px 12px' : '32px 20px'}}>
        <div style={{marginBottom:28}}>
          <div style={{fontSize:22,fontWeight:700,color:'#1a3a2a',marginBottom:4}}>Forms</div>
          <div style={{fontSize:14,color:'#6b7280'}}>Submit and manage requests across all Pabari Group companies.</div>
        </div>

        {/* Pending approvals banner */}
        {pending && pending.total > 0 && (
          <div style={{
            marginBottom:20, padding:'12px 16px',
            background:'#fffbeb', border:'1px solid #f59e0b',
            borderRadius:8, display:'flex', alignItems:'center', gap:10,
          }}>
            <span style={{fontSize:18}}>🔔</span>
            <div style={{flex:1}}>
              <span style={{fontSize:13,fontWeight:700,color:'#92400e'}}>
                {pending.total} request{pending.total !== 1 ? 's' : ''} pending your approval —{' '}
              </span>
              {pending.leave > 0 && <span style={{fontSize:12,color:'#b45309'}}>Leave ({pending.leave}){pending.pettyCashGeneral > 0 ? ' · ' : ''}</span>}
              {pending.pettyCashGeneral > 0 && <span style={{fontSize:12,color:'#b45309'}}>Petty Cash ({pending.pettyCashGeneral})</span>}
            </div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
          {forms.map(f => (
            <div key={f.title} style={{background:'white',borderRadius:10,boxShadow:'0 1px 6px rgba(0,0,0,0.07)',overflow:'hidden',border:`1px solid ${f.pendingCount > 0 ? '#f59e0b' : '#f0f0f0'}`}}>
              <div style={{padding:'24px 22px 16px'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
                  <div style={{fontSize:36}}>{f.icon}</div>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    {f.pendingCount > 0 && (
                      <span style={{background:'#ef4444',color:'white',fontSize:11,fontWeight:700,minWidth:20,height:20,padding:'0 6px',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {f.pendingCount}
                      </span>
                    )}
                    <span style={{background:f.badgeColor,color:'white',fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:4,letterSpacing:'0.5px'}}>{f.badge}</span>
                  </div>
                </div>
                <div style={{fontSize:15,fontWeight:700,color:'#1a3a2a',marginBottom:6}}>{f.title}</div>
                <div style={{fontSize:13,color:'#6b7280',lineHeight:1.6}}>{f.description}</div>
                {f.pendingCount > 0 && (
                  <div style={{marginTop:10,fontSize:12,fontWeight:600,color:'#b45309',background:'#fffbeb',borderRadius:5,padding:'5px 9px',display:'inline-block'}}>
                    {f.pendingCount} pending your approval
                  </div>
                )}
              </div>
              <div style={{borderTop:'1px solid #f0f0f0',padding:'12px 22px',display:'flex',gap:8}}>
                <a href={f.newHref}
                  style={{flex:1,background:'#1a3a2a',color:'white',padding:'9px 0',borderRadius:6,textDecoration:'none',fontSize:13,fontWeight:600,textAlign:'center',display:'block'}}>
                  + New Request
                </a>
                <a href={f.listHref}
                  style={{padding:'9px 14px',background:'#f3f4f6',color:'#374151',borderRadius:6,textDecoration:'none',fontSize:13,fontWeight:500,whiteSpace:'nowrap'}}>
                  View All
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
