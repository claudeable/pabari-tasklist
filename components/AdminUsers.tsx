'use client'
import { useState } from 'react'
import { SessionUser, DEPARTMENTS, UserRole } from '@/types'
import InactivityGuard from './InactivityGuard'

interface UserRow {
  id: string; name: string; email: string; role: UserRole
  department: string; reports_to: string; hod_email: string; companies: string[]; created_at: string
}
interface Props { currentUser: SessionUser; initialUsers: UserRow[] }

const ROLES: UserRole[] = ['admin','director','ceo','manager','staff']

const ACCESS_OPTIONS = [
  { value: 'ALL',    label: 'All Companies',  desc: 'Full group-wide access' },
  { value: 'KISCOL', label: 'KISCOL Only',    desc: 'Restricted to KISCOL tasks' },
]
const ROLE_STYLE: Record<UserRole,{bg:string;color:string}> = {
  admin:    { bg:'#1a3a2a', color:'white'   },
  director: { bg:'#b5833a', color:'white'   },
  ceo:      { bg:'#7c3aed', color:'white'   },
  manager:  { bg:'#1d4ed8', color:'white'   },
  staff:    { bg:'#f3f4f6', color:'#374151' },
}

const BLANK = { name:'', email:'', role:'staff' as UserRole, department:'', reports_to:'', hod_email:'', companies: ['ALL'] as string[] }

export default function AdminUsers({ currentUser, initialUsers }: Props) {
  const [users,    setUsers]    = useState<UserRow[]>(initialUsers)
  const [showForm, setShowForm] = useState(false)
  const [editId,   setEditId]   = useState<string|null>(null)
  const [form,     setForm]     = useState(BLANK)
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [search,   setSearch]   = useState('')

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const openAdd  = () => { setForm(BLANK); setEditId(null); setError(''); setShowForm(true) }
  const openEdit = (u: UserRow) => {
    setForm({ name:u.name, email:u.email, role:u.role, department:u.department, reports_to:u.reports_to, hod_email:u.hod_email||'', companies: u.companies ?? ['ALL'] })
    setEditId(u.id); setError(''); setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError('Name and email are required'); return }
    setSaving(true); setError('')
    try {
      const url    = editId ? `/api/admin/users/${editId}` : '/api/admin/users'
      const method = editId ? 'PATCH' : 'POST'
      const res    = await fetch(url, { method, headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(form) })
      const data   = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      if (editId) {
        setUsers(us => us.map(u => u.id === editId ? { ...u, ...form } : u))
      } else {
        setUsers(us => [...us, data])
      }
      setShowForm(false)
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setSaving(false) }
  }

  const resetPw = async (id: string, name: string) => {
    if (!confirm(`Reset ${name}'s password to changeme123?`)) return
    await fetch(`/api/admin/users/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ action:'reset-password' }) })
    alert(`Password reset for ${name}`)
  }

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete user ${name}? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method:'DELETE', credentials:'include' })
    if (res.ok) setUsers(us => us.filter(u => u.id !== id))
  }

  const filtered = users.filter(u =>
    !search || u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.department.toLowerCase().includes(search.toLowerCase())
  )

  const managerOptions = users.filter(u => u.role !== 'staff')

  const inp: React.CSSProperties = { border:'1px solid #d1d5db',borderRadius:4,padding:'7px 10px',fontSize:13,width:'100%' }
  const lbl: React.CSSProperties = { display:'block',fontSize:10,fontWeight:700,color:'#9ca3af',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:4 }

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',fontFamily:'Inter,Arial,sans-serif',background:'#f3f4f6'}}>
      <InactivityGuard />

      {/* NAV */}
      <div style={{background:'#1a3a2a',padding:'0 18px',display:'flex',alignItems:'center',gap:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        <span style={{fontSize:13,fontWeight:700,color:'white'}}>PABARI GROUP</span>
        <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
        <a href="/" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>← Portal</a>
        <div style={{width:1,height:14,background:'rgba(255,255,255,0.2)',margin:'0 2px'}}/>
        <a href="/tasks"     style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Task Board</a>
        <a href="/dashboard" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Dashboard</a>
        <a href="/reports"   style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Reports</a>
        <a href="/admin/users" style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>User Management</a>
        <a href="/admin/security" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Security Centre</a>
        <div style={{flex:1}}/>
        <span style={{color:'rgba(255,255,255,0.7)',fontSize:12}}>{currentUser.name}</span>
      </div>

      <div style={{flex:1,overflow:'auto',padding:24}}>

        {/* HEADER */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
          <div>
            <div style={{fontWeight:800,fontSize:20,color:'#111'}}>User Management</div>
            <div style={{fontSize:12,color:'#6b7280',marginTop:2}}>{users.length} users · Admin only</div>
          </div>
          <button onClick={openAdd}
            style={{background:'#1a3a2a',color:'white',border:'none',borderRadius:5,padding:'9px 20px',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            + Add User
          </button>
        </div>


        {/* SEARCH */}
        <div style={{background:'white',border:'1px solid #e5e7eb',borderRadius:8,overflow:'hidden'}}>
          <div style={{padding:'12px 20px',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:12}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, email or department…"
              style={{border:'1px solid #d1d5db',borderRadius:4,padding:'6px 10px',fontSize:13,width:300,outline:'none'}}/>
            <span style={{fontSize:12,color:'#9ca3af'}}>{filtered.length} of {users.length}</span>
          </div>

          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#f9fafb'}}>
                {['Name','Email','Role','Department','Supervisor','HOD','Access','Actions'].map(h=>(
                  <th key={h} style={{padding:'9px 16px',textAlign:'left',fontSize:10,fontWeight:700,color:'#9ca3af',letterSpacing:'0.5px',textTransform:'uppercase',borderBottom:'1px solid #e5e7eb'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u,i)=>(
                <tr key={u.id} style={{borderBottom:'1px solid #f3f4f6',background:i%2===0?'white':'#fafafa'}}>
                  <td style={{padding:'11px 16px',fontWeight:600,color:'#111',fontSize:13}}>{u.name}</td>
                  <td style={{padding:'11px 16px',fontSize:12,color:'#4b5563'}}>{u.email}</td>
                  <td style={{padding:'11px 16px'}}>
                    <span style={{fontSize:9.5,fontWeight:700,padding:'2px 8px',borderRadius:10,textTransform:'uppercase',letterSpacing:'0.5px',
                      background:ROLE_STYLE[u.role].bg, color:ROLE_STYLE[u.role].color}}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{padding:'11px 16px',fontSize:12,color:'#374151'}}>{u.department||'—'}</td>
                  <td style={{padding:'11px 16px',fontSize:12,color:'#6b7280'}}>
                    {u.reports_to ? (users.find(x=>x.email===u.reports_to)?.name || u.reports_to) : '—'}
                  </td>
                  <td style={{padding:'11px 16px',fontSize:12,color:'#6b7280'}}>
                    {u.hod_email ? (users.find(x=>x.email===u.hod_email)?.name || u.hod_email) : '—'}
                  </td>
                  <td style={{padding:'11px 16px'}}>
                    {(u.companies ?? ['ALL']).includes('ALL')
                      ? <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:8,background:'#dbeafe',color:'#1d4ed8'}}>All Companies</span>
                      : <span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:8,background:'#dcfce7',color:'#15803d'}}>KISCOL Only</span>
                    }
                  </td>
                  <td style={{padding:'11px 16px'}}>
                    <div style={{display:'flex',gap:5}}>
                      <button onClick={()=>openEdit(u)}
                        style={{background:'white',color:'#374151',border:'1px solid #d1d5db',borderRadius:4,padding:'3px 10px',fontSize:11,cursor:'pointer'}}>
                        Edit
                      </button>
                      <button onClick={()=>resetPw(u.id,u.name)}
                        style={{background:'white',color:'#d97706',border:'1px solid #fde68a',borderRadius:4,padding:'3px 10px',fontSize:11,cursor:'pointer'}}>
                        Reset PW
                      </button>
                      {u.id !== currentUser.id && (
                        <button onClick={()=>remove(u.id,u.name)}
                          style={{background:'white',color:'#dc2626',border:'1px solid #fee2e2',borderRadius:4,padding:'3px 10px',fontSize:11,cursor:'pointer'}}>
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{background:'#1a3a2a',color:'rgba(255,255,255,0.55)',fontSize:10.5,padding:'5px 20px',display:'flex',gap:14,alignItems:'center',flexShrink:0}}>
        <span style={{color:'rgba(255,255,255,0.85)',fontWeight:600}}>PABARI GROUP</span>
        <span>·</span><span>Admin Panel — User Management</span>
        <span>·</span><span>{currentUser.name}</span>
      </div>

      {/* ADD / EDIT MODAL */}
      {showForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}
          onClick={e=>{ if(e.target===e.currentTarget) setShowForm(false) }}>
          <div style={{background:'white',borderRadius:10,padding:28,width:'100%',maxWidth:700,maxHeight:'90vh',overflowY:'auto',boxShadow:'0 8px 32px rgba(0,0,0,0.25)'}}>
            <div style={{fontWeight:700,fontSize:16,marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              {editId ? 'Edit User' : 'Add New User'}
              <button onClick={()=>setShowForm(false)} style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:'#9ca3af',lineHeight:1}}>✕</button>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:14}}>
              <div><label style={lbl}>Full Name</label><input value={form.name} onChange={e=>setF('name',e.target.value)} style={inp} placeholder="e.g. John Doe"/></div>
              <div><label style={lbl}>Email</label><input value={form.email} onChange={e=>setF('email',e.target.value)} style={inp} placeholder="john@usm.co.ke" type="email"/></div>
              <div>
                <label style={lbl}>Role</label>
                <select value={form.role} onChange={e=>setF('role',e.target.value)} style={inp}>
                  {ROLES.map(r=><option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Department</label>
                <select value={form.department} onChange={e=>setF('department',e.target.value)} style={inp}>
                  <option value="">— Select —</option>
                  {DEPARTMENTS.map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Supervisor (Reports To)</label>
                <select value={form.reports_to} onChange={e=>setF('reports_to',e.target.value)} style={inp}>
                  <option value="">— None —</option>
                  {managerOptions.map(u=><option key={u.id} value={u.email}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>HOD (Head of Department)</label>
                <select value={form.hod_email} onChange={e=>setF('hod_email',e.target.value)} style={inp}>
                  <option value="">— None / Same as Supervisor —</option>
                  {managerOptions.map(u=><option key={u.id} value={u.email}>{u.name} ({u.role})</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Company Access</label>
                <div style={{display:'flex',gap:8}}>
                  {ACCESS_OPTIONS.map(opt => {
                    const isSelected = opt.value === 'ALL' ? form.companies.includes('ALL') : !form.companies.includes('ALL')
                    return (
                      <label key={opt.value} style={{
                        display:'flex',gap:8,alignItems:'flex-start',cursor:'pointer',flex:1,
                        background: isSelected ? '#f0fdf4' : 'white',
                        border:`1px solid ${isSelected ? '#86efac' : '#e5e7eb'}`,
                        borderRadius:5,padding:'7px 10px',
                      }}>
                        <input type="radio" name="companies" value={opt.value}
                          checked={isSelected}
                          onChange={() => setForm(f => ({ ...f, companies: opt.value === 'ALL' ? ['ALL'] : ['KISCOL'] }))}
                          style={{marginTop:2,accentColor:'#1a3a2a'}}/>
                        <div>
                          <div style={{fontSize:12,fontWeight:600,color:'#374151'}}>{opt.label}</div>
                          <div style={{fontSize:10,color:'#9ca3af',marginTop:1}}>{opt.desc}</div>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
              {!editId && (
                <div style={{display:'flex',alignItems:'flex-end'}}>
                  <div style={{background:'#f9fafb',border:'1px solid #e5e7eb',borderRadius:4,padding:'7px 10px',fontSize:12,color:'#6b7280',width:'100%'}}>
                    Default password: <strong>changeme123</strong>
                  </div>
                </div>
              )}
            </div>
            {error && <div style={{color:'#dc2626',fontSize:12,marginBottom:10}}>{error}</div>}
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',borderTop:'1px solid #f3f4f6',paddingTop:16,marginTop:4}}>
              <button onClick={()=>setShowForm(false)}
                style={{border:'1px solid #d1d5db',background:'white',borderRadius:4,padding:'8px 18px',fontSize:13,cursor:'pointer'}}>
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                style={{background:'#1a3a2a',color:'white',border:'none',borderRadius:4,padding:'8px 22px',fontSize:13,fontWeight:600,cursor:'pointer',opacity:saving?0.7:1}}>
                {saving ? 'Saving…' : editId ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
