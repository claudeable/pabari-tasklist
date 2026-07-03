'use client'

import { useState } from 'react'
import InactivityGuard from './InactivityGuard'
import {
  ResponsiveContainer, PieChart, Pie, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { SessionUser } from '@/types'

const STATUS_COLOR: Record<string, string> = {
  'action-required':    '#dc2626',
  'pending-discussion': '#d97706',
  'in-review':          '#1d4ed8',
  'resolved':           '#15803d',
  'expired':            '#6b7280',
}
const STATUS_LABEL: Record<string, string> = {
  'action-required':    'Action Required',
  'pending-discussion': 'Pending',
  'in-review':          'In Review',
  'resolved':           'Resolved',
  'expired':            'Expired',
}
const ROLE_BADGE: Record<string, {bg:string;color:string;label:string}> = {
  admin:    { bg:'#1a3a2a', color:'white',   label:'ADMIN'    },
  director: { bg:'#b5833a', color:'white',   label:'DIRECTOR' },
  manager:  { bg:'#1d4ed8', color:'white',   label:'MANAGER'  },
  staff:    { bg:'#f3f4f6', color:'#374151', label:'STAFF'    },
}
const AVATAR_COLORS: Record<string, string> = {
  harshil: '#b5833a', sabina: '#6c5ce7', ahmad: '#e17055',
  ashok: '#0984e3', paul: '#2d6a4f', krishnan: '#00b894',
  yalelet: '#fd79a8', suresh: '#5f27cd', benson: '#00cec9',
  andu: '#d63031', yared: '#e84393', simon: '#74b9ff',
  rajveer: '#a29bfe', pedro: '#2d3436',
}
function avatarColor(name: string) {
  return AVATAR_COLORS[name.toLowerCase().split(/[\s&./]+/)[0]] || '#2d6a4f'
}
function avatarInitials(name: string) {
  return name.split(/[\s&./]+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0, 2)
}
function weekNum() {
  const d = new Date(), s = new Date(d.getFullYear(), 0, 1)
  return `WK-${Math.ceil(((d.getTime()-s.getTime())/86400000+s.getDay()+1)/7)}`
}

interface CompanyRow {
  company: string; total: number; action: number; pending: number; review: number; resolved: number; expired: number
}
interface PersonRow { name: string; open: number; action: number }
interface DeptRow   { dept: string; open: number; pendingReview: number }
interface Stats {
  total: number
  open: number
  byStatus: Record<string, number>
  byCompany: CompanyRow[]
  byPerson: PersonRow[]
  byDepartment: DeptRow[]
}
interface Props { currentUser: SessionUser; stats: Stats }

export default function Dashboard({ currentUser, stats }: Props) {
  const [showChangePw,   setShowChangePw]   = useState(false)
  const [pwForm,         setPwForm]         = useState({ current:'', next:'', confirm:'' })
  const [pwError,        setPwError]        = useState('')
  const [pwSuccess,      setPwSuccess]      = useState(false)
  const [pwSaving,       setPwSaving]       = useState(false)

  const rb = ROLE_BADGE[currentUser.role] || ROLE_BADGE.staff

  async function signOut() {
    await fetch('/api/auth/logout', { method:'POST' })
    window.location.href = '/login'
  }

  // ── Pie data ────────────────────────────────────────────────────
  const pieData = Object.entries(stats.byStatus).map(([k, v]) => ({
    name: STATUS_LABEL[k] || k, value: v, key: k,
    fill: STATUS_COLOR[k] || '#9ca3af',
  }))

  // ── Company bar data (top 12) ───────────────────────────────────
  const companyData = stats.byCompany.map(c => ({
    name: c.company,
    full: c.company,
    Action:   c.action,
    Pending:  c.pending,
    Review:   c.review,
    Resolved: c.resolved,
    Expired:  c.expired,
  }))

  // ── Person bar data ─────────────────────────────────────────────
  const personData = stats.byPerson.slice(0, 10).map(p => ({
    name:   p.name.split(' ')[0],
    full:   p.name,
    Open:   p.open,
    Action: p.action,
  }))

  const awaitingApproval = (stats.byStatus['awaiting-hod-approval'] || 0) + (stats.byStatus['awaiting-hk-approval'] || 0)
  const kpis = [
    { label: 'Total Tasks',       val: stats.total,                                col: '#1e40af', sub: 'across all companies' },
    { label: 'Open / Active',     val: stats.open,                                 col: '#92400e', sub: 'not resolved or expired' },
    { label: 'Action Required',   val: stats.byStatus['action-required']   || 0,   col: '#b91c1c', sub: 'need immediate action' },
    { label: 'Pending Discussion',val: stats.byStatus['pending-discussion'] || 0,   col: '#d97706', sub: 'awaiting discussion' },
    { label: 'Awaiting Approval', val: awaitingApproval,                            col: '#7c3aed', sub: 'HOD + HK pending review' },
    { label: 'Resolved',          val: stats.byStatus['resolved']           || 0,   col: '#15803d', sub: 'completed items' },
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',overflow:'hidden',background:'#f9fafb'}}>
      <InactivityGuard />

      {/* TOP NAV */}
      <div style={{background:'#1a3a2a',padding:'0 18px',display:'flex',alignItems:'center',gap:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        <span style={{fontSize:13,fontWeight:700,color:'white',letterSpacing:'0.2px'}}>PABARI GROUP</span>
        <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
        <a href="/dashboard" style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>Dashboard</a>
        <a href="/tasks"     style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12,fontWeight:400}}>Task Board</a>
        <a href="/reports"   style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12,fontWeight:400}}>Reports</a>
        <div style={{flex:1}}/>
        <span style={{background:'rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.8)',fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:14}}>{weekNum()}</span>
        <div style={{display:'flex',alignItems:'center',gap:6,background:'rgba(255,255,255,0.08)',borderRadius:20,padding:'3px 10px 3px 5px'}}>
          <div style={{width:24,height:24,borderRadius:'50%',background:avatarColor(currentUser.name),color:'white',fontSize:10,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {avatarInitials(currentUser.name)}
          </div>
          <span style={{fontSize:12,color:'white',fontWeight:500}}>{currentUser.name}</span>
          <span style={{background:rb.bg,color:rb.color,fontSize:9,fontWeight:700,padding:'1px 5px',borderRadius:8,marginLeft:2}}>{rb.label}</span>
        </div>
        <button onClick={()=>{setShowChangePw(true);setPwForm({current:'',next:'',confirm:''});setPwError('');setPwSuccess(false)}}
          style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.15)',padding:'5px 11px',borderRadius:5,fontSize:11,cursor:'pointer'}}>
          Change Password
        </button>
        <button onClick={signOut}
          style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.7)',border:'1px solid rgba(255,255,255,0.15)',padding:'5px 11px',borderRadius:5,fontSize:11,cursor:'pointer'}}>
          Sign Out
        </button>
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showChangePw && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={e=>{if(e.target===e.currentTarget)setShowChangePw(false)}}>
          <div style={{background:'white',borderRadius:8,padding:'28px 32px',width:360,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
              <div style={{fontWeight:700,fontSize:15,color:'#111827'}}>Change Password</div>
              <button onClick={()=>setShowChangePw(false)} style={{background:'none',border:'none',fontSize:18,color:'#9ca3af',cursor:'pointer'}}>✕</button>
            </div>
            {pwSuccess
              ? <div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:6,padding:'14px 16px',textAlign:'center'}}>
                  <div style={{fontSize:22,marginBottom:8}}>✓</div>
                  <div style={{fontWeight:600,color:'#15803d',fontSize:13}}>Password changed successfully.</div>
                  <button onClick={()=>setShowChangePw(false)} style={{marginTop:14,background:'#1a3a2a',color:'white',border:'none',borderRadius:5,padding:'7px 20px',fontSize:12,fontWeight:600,cursor:'pointer'}}>Close</button>
                </div>
              : <>
                  {[{label:'Current Password',key:'current',ph:'Enter your current password'},{label:'New Password',key:'next',ph:'At least 8 characters'},{label:'Confirm New',key:'confirm',ph:'Repeat new password'}].map(f=>(
                    <div key={f.key} style={{marginBottom:14}}>
                      <label style={{display:'block',fontSize:11,fontWeight:600,color:'#374151',marginBottom:4}}>{f.label}</label>
                      <input type="password" value={(pwForm as Record<string,string>)[f.key]} onChange={e=>setPwForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.ph}
                        style={{width:'100%',border:'1px solid #d1d5db',borderRadius:5,padding:'8px 10px',fontSize:13,fontFamily:'inherit',boxSizing:'border-box'}}/>
                    </div>
                  ))}
                  {pwError && <div style={{background:'#fef2f2',border:'1px solid #fecaca',borderRadius:5,padding:'8px 11px',fontSize:12,color:'#dc2626',marginBottom:12}}>{pwError}</div>}
                  <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:4}}>
                    <button onClick={()=>setShowChangePw(false)} style={{border:'1px solid #d1d5db',background:'white',borderRadius:5,padding:'7px 16px',fontSize:12,cursor:'pointer'}}>Cancel</button>
                    <button disabled={pwSaving} onClick={async()=>{
                      setPwError('')
                      if (!pwForm.current||!pwForm.next||!pwForm.confirm){setPwError('All fields are required.');return}
                      if (pwForm.next!==pwForm.confirm){setPwError('New passwords do not match.');return}
                      if (pwForm.next.length<8){setPwError('New password must be at least 8 characters.');return}
                      setPwSaving(true)
                      try {
                        const res=await fetch('/api/auth/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:pwForm.current,newPassword:pwForm.next})})
                        const data=await res.json()
                        if(!res.ok){setPwError(data.error||'Failed.')}else{setPwSuccess(true)}
                      } catch{setPwError('Network error.')} finally{setPwSaving(false)}
                    }} style={{background:pwSaving?'#9ca3af':'#1a3a2a',color:'white',border:'none',borderRadius:5,padding:'7px 18px',fontSize:12,fontWeight:600,cursor:pwSaving?'not-allowed':'pointer'}}>
                      {pwSaving?'Saving…':'Update Password'}
                    </button>
                  </div>
                </>
            }
          </div>
        </div>
      )}

      {/* BODY */}
      <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>

        {/* KPI CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:12,marginBottom:20}}>
          {kpis.map(k=>(
            <div key={k.label} style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'14px 16px',borderTop:`3px solid ${k.col}`}}>
              <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.6px',color:'#9ca3af',fontWeight:600,marginBottom:4}}>{k.label}</div>
              <div style={{fontSize:30,fontWeight:800,color:k.col,lineHeight:1}}>{k.val}</div>
              <div style={{fontSize:10.5,color:'#9ca3af',marginTop:4}}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* DEPARTMENT BREAKDOWN */}
        {stats.byDepartment.length > 0 && (() => {
          const deptData = stats.byDepartment.map(d => ({
            name: d.dept.replace(' & Corporate','').replace(' / Hospitality','').replace(' Operations',''),
            full: d.dept,
            Open:    d.open,
            Pending: d.pendingReview,
          }))
          const chartH = Math.max(deptData.length * 42 + 20, 120)
          return (
            <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'18px 16px',marginBottom:14}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:700,color:'#111827'}}>Tasks by Department</div>
                <div style={{display:'flex',gap:14,fontSize:10.5,color:'#6b7280'}}>
                  <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'#93c5fd',display:'inline-block'}}/> Open Tasks</span>
                  <span style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:'#a78bfa',display:'inline-block'}}/> Pending Review</span>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={chartH}>
                <BarChart data={deptData} layout="vertical" margin={{left:4,right:32,top:0,bottom:0}} barCategoryGap="30%" barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6"/>
                  <XAxis type="number" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis type="category" dataKey="name" tick={{fontSize:11,fontWeight:500}} width={130} axisLine={false} tickLine={false} interval={0}/>
                  <Tooltip contentStyle={{fontSize:11,borderRadius:6}}
                    formatter={(v,n) => [v, n==='Pending'?'Pending Review':'Open Tasks']}
                    labelFormatter={(_,p) => p?.[0]?.payload?.full || ''}/>
                  <Bar dataKey="Open"    fill="#93c5fd" name="Open"    radius={[0,3,3,0]}/>
                  <Bar dataKey="Pending" fill="#a78bfa" name="Pending" radius={[0,3,3,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )
        })()}

        {/* ROW 1: Pie + People workload */}
        <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:14,marginBottom:14}}>

          {/* Status donut */}
          <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'18px 16px'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#111827',marginBottom:14}}>Status Distribution</div>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" />
                <Tooltip contentStyle={{fontSize:12,borderRadius:6}} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize:11}} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* People workload */}
          <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'18px 16px'}}>
            <div style={{fontSize:12,fontWeight:700,color:'#111827',marginBottom:14}}>Open Tasks by Person</div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={personData} layout="vertical" margin={{left:8,right:24,top:0,bottom:0}} barCategoryGap="28%">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6"/>
                <XAxis type="number" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={65} axisLine={false} tickLine={false} interval={0}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6}} formatter={(v,n) => [v, n==='Action'?'Action Required':'Open Tasks']}/>
                <Bar dataKey="Open"   stackId="b" fill="#93c5fd" name="Open" />
                <Bar dataKey="Action" stackId="b" fill={STATUS_COLOR['action-required']} name="Action Required" radius={[0,3,3,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ROW 2: Company breakdown — full width, all companies */}
        <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,padding:'18px 16px',marginBottom:14}}>
          <div style={{fontSize:12,fontWeight:700,color:'#111827',marginBottom:14}}>Tasks by Company — All {stats.byCompany.length} Companies</div>
          <ResponsiveContainer width="100%" height={stats.byCompany.length * 34 + 10}>
            <BarChart data={companyData} layout="vertical" margin={{left:4,right:24,top:0,bottom:0}} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6"/>
              <XAxis type="number" tick={{fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis type="category" dataKey="name" tick={{fontSize:10.5,fontWeight:500}} width={110} axisLine={false} tickLine={false} interval={0}/>
              <Tooltip contentStyle={{fontSize:11,borderRadius:6}} />
              <Bar dataKey="Action"   stackId="a" fill={STATUS_COLOR['action-required']}    name="Action Req." />
              <Bar dataKey="Pending"  stackId="a" fill={STATUS_COLOR['pending-discussion']}  name="Pending" />
              <Bar dataKey="Review"   stackId="a" fill={STATUS_COLOR['in-review']}           name="In Review" />
              <Bar dataKey="Resolved" stackId="a" fill={STATUS_COLOR['resolved']}            name="Resolved" radius={[0,3,3,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* STATUS BAR */}
      <div style={{background:'#1a3a2a',color:'rgba(255,255,255,0.55)',fontSize:10.5,padding:'5px 20px',display:'flex',gap:14,alignItems:'center',flexShrink:0}}>
        <span style={{color:'rgba(255,255,255,0.85)',fontWeight:600}}>PABARI GROUP</span>
        <span>·</span>
        <span>Dashboard</span>
        <span>·</span>
        <span>{currentUser.name} ({currentUser.role})</span>
        <span>·</span>
        <span>{weekNum()}</span>
        <span>·</span>
        <span>{new Date().toISOString().slice(0,10)}</span>
        <div style={{flex:1}}/>
        <span style={{color:'rgba(255,255,255,0.3)'}}>{stats.total} total tasks</span>
      </div>

    </div>
  )
}
