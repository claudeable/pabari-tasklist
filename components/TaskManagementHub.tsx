'use client'

import { useEffect, useState } from 'react'
import { SessionUser } from '@/types'

interface Props { currentUser: SessionUser; userType: 'admin' | 'paul' | 'yalelet' }

interface Module {
  key: string; icon: string; label: string; desc: string
  href: string; accent: string; badge: string
}

const ALL_MODULES: Module[] = [
  { key:'board',          icon:'📋', label:'Task Board',          desc:'View, manage and update all tasks across companies',     href:'/tasks',           accent:'#22c55e', badge:'Open board'       },
  { key:'intelligence',   icon:'⚡', label:'Pabari Intelligence',  desc:'Executive dashboard · Analytics · AI-powered insights',  href:'/intelligence',    accent:'#f59e0b', badge:'Open dashboard'   },
  { key:'connect',        icon:'📇', label:'Pabari Connect',       desc:'Contacts · Directory · Company search',                  href:'/connect',         accent:'#b5833a', badge:'Open directory'   },
  { key:'dashboard',      icon:'📊', label:'Dashboard',            desc:'KPIs, overdue tasks and status summaries',               href:'/dashboard',       accent:'#3b82f6', badge:'Open dashboard'   },
  { key:'reports',        icon:'📈', label:'Reports',              desc:'Weekly reports, task analytics and export',              href:'/reports',         accent:'#8b5cf6', badge:'View reports'     },
  { key:'documents',      icon:'📁', label:'Documents',            desc:'Shared files, attachments and document management',      href:'/documents',       accent:'#f59e0b', badge:'Open documents'   },
  { key:'finance',        icon:'💰', label:'Finance',              desc:'Invoices, petty cash, payment tracking',                 href:'/finance',         accent:'#10b981', badge:'Open finance'     },
  { key:'delivery-notes', icon:'🚚', label:'Delivery Notes',       desc:'Delivery note management and tracking',                  href:'/delivery-notes',  accent:'#06b6d4', badge:'View notes'       },
  { key:'projects',       icon:'🏗️', label:'Projects',             desc:'Project tracking, milestones and progress',              href:'/projects',        accent:'#f97316', badge:'View projects'    },
  { key:'centre',         icon:'🏢', label:'Centre',               desc:'Company centre — announcements and resources',           href:'/centre',          accent:'#6366f1', badge:'Open centre'      },
]

const MODULES_BY_TYPE: Record<string, string[]> = {
  admin:   ['board','intelligence','connect','dashboard','reports','documents','finance','delivery-notes','projects','centre'],
  paul:    ['board','intelligence'],
  yalelet: ['board','delivery-notes'],
}

function logout() {
  fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    .finally(() => { window.location.href = '/' })
}

// Simple task summary card for Yalelet
function YalelTaskSummary() {
  const [stats, setStats] = useState<{open:number;high:number;myTasks:number}|null>(null)
  useEffect(() => {
    fetch('/api/tasks', { credentials:'include' })
      .then(r => r.ok ? r.json() : [])
      .then((tasks: {status:string;priority:string;responsible:string}[]) => {
        const open    = tasks.filter(t => !['resolved','archived','expired'].includes(t.status)).length
        const high    = tasks.filter(t => t.priority === 'high' && !['resolved','archived','expired'].includes(t.status)).length
        const myTasks = tasks.filter(t => !['resolved','archived','expired'].includes(t.status)).length
        setStats({ open, high, myTasks })
      }).catch(() => {})
  }, [])

  if (!stats) return null

  return (
    <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:14, padding:'24px', marginBottom:22, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:16 }}>Task Summary</div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          { label:'Open Tasks',      value:stats.open,    color:'#3b82f6' },
          { label:'High Priority',   value:stats.high,    color:'#ef4444' },
          { label:'My Tasks',        value:stats.myTasks, color:'#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ textAlign:'center', padding:'12px 8px', background:'#f8fafc', borderRadius:8, border:'1px solid #e2e8f0' }}>
            <div style={{ fontSize:28, fontWeight:900, color:s.color, lineHeight:1 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'#64748b', marginTop:4 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TaskManagementHub({ currentUser, userType }: Props) {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const firstName = currentUser.name.split(' ')[0]
  const keys      = MODULES_BY_TYPE[userType] ?? ['board']
  const visible   = keys.map(k => ALL_MODULES.find(m => m.key === k)!).filter(Boolean)
  const gridCols  = isMobile ? 1 : Math.min(visible.length, 3)

  return (
    <div style={{ minHeight:'100vh', background:'#f8fafc', fontFamily:'Inter,Arial,sans-serif', display:'flex', flexDirection:'column' }}>

      {/* NAV */}
      <nav style={{ background:'#0f1a12', borderBottom:'1px solid #1e2e1a', padding: isMobile ? '0 16px' : '0 32px', display:'flex', alignItems:'center', height:52, position:'sticky', top:0, zIndex:50, gap:16 }}>
        <a href="/" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none' }}>
          <span style={{ fontWeight:900, fontSize:15, color:'#b5833a', letterSpacing:'0.15em' }}>PABARI</span>
          {!isMobile && <span style={{ fontSize:9, color:'#4a7055', fontWeight:700, background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:4, padding:'2px 6px', letterSpacing:'0.06em' }}>WORKSPACE</span>}
        </a>
        <div style={{ flex:1 }} />
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'4px 12px' }}>
          <div style={{ width:24, height:24, borderRadius:'50%', background:'#1a3a2a', border:'1px solid #22c55e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#22c55e' }}>
            {firstName[0].toUpperCase()}
          </div>
          {!isMobile && <span style={{ fontSize:12, color:'rgba(255,255,255,0.7)', fontWeight:500 }}>{currentUser.name}</span>}
          <button onClick={logout} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:11, cursor:'pointer', marginLeft:4, padding:0 }}>Sign out</button>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ background:'linear-gradient(135deg, #0f1a12 0%, #1a2d1f 100%)', padding: isMobile ? '28px 16px 32px' : '40px 32px 44px', borderBottom:'1px solid #1e2e1a' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#4a7055', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 }}>Task Management</div>
          <h1 style={{ margin:0, fontSize: isMobile ? 26 : 36, fontWeight:900, color:'#e2ede7', lineHeight:1.1, letterSpacing:'-0.02em' }}>
            Welcome back, {firstName}
          </h1>
          <p style={{ margin:'8px 0 0', color:'#4a7055', fontSize: isMobile ? 12 : 13 }}>Select a module to get started</p>
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ flex:1, maxWidth:960, margin:'0 auto', width:'100%', padding: isMobile ? '28px 16px 56px' : '44px 32px 72px' }}>

        {userType === 'yalelet' && <YalelTaskSummary />}

        <div style={{ fontSize:11, fontWeight:700, color:'#94a3b8', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:22 }}>Modules</div>

        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : `repeat(${gridCols}, 1fr)`, gap: isMobile ? 14 : 22 }}>
          {visible.map(m => (
            <a key={m.key} href={m.href} style={{ textDecoration:'none', display:'block' }}>
              <div
                style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:14, padding: isMobile ? '22px 20px' : '28px 24px', cursor:'pointer', transition:'all 0.15s', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', position:'relative', overflow:'hidden' }}
                onMouseEnter={e => { const el = e.currentTarget; el.style.transform='translateY(-3px)'; el.style.boxShadow=`0 10px 28px rgba(0,0,0,0.10)`; el.style.borderColor=m.accent }}
                onMouseLeave={e => { const el = e.currentTarget; el.style.transform='translateY(0)'; el.style.boxShadow='0 1px 4px rgba(0,0,0,0.06)'; el.style.borderColor='#e2e8f0' }}
              >
                <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:m.accent, borderRadius:'14px 14px 0 0' }} />
                <div style={{ fontSize: isMobile ? 32 : 40, marginBottom:14, lineHeight:1 }}>{m.icon}</div>
                <div style={{ fontSize: isMobile ? 16 : 19, fontWeight:800, color:'#0f172a', marginBottom:5, letterSpacing:'-0.01em' }}>{m.label}</div>
                <div style={{ fontSize: isMobile ? 11 : 12, color:'#64748b', marginBottom:16, lineHeight:1.5 }}>{m.desc}</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:11, fontWeight:700, color:m.accent, background:`${m.accent}18`, border:`1px solid ${m.accent}33`, borderRadius:20, padding:'3px 10px' }}>{m.badge}</span>
                  <span style={{ fontSize:16, color:'#cbd5e1' }}>→</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
