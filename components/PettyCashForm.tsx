'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionUser } from '@/types'
import { LEAVE_COMPANIES } from '@/lib/leaveTypes'

interface Props {
  currentUser: SessionUser
  hodName:     string
  hasKiscol:   boolean
}

interface Item { id: string; description: string; account_no: string; amount: string }

const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const tens  = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

function numWords(n: number): string {
  if (n === 0) return ''
  if (n < 20)  return ones[n] + ' '
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '') + ' '
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred ' + numWords(n%100)
  if (n < 1000000) return numWords(Math.floor(n/1000)) + 'Thousand ' + numWords(n%1000)
  return numWords(Math.floor(n/1000000)) + 'Million ' + numWords(n%1000000)
}

function amountInWords(amount: number): string {
  if (!amount || amount <= 0) return ''
  const whole = Math.floor(amount)
  const cents = Math.round((amount - whole) * 100)
  let w = 'Kenya Shillings ' + numWords(whole).trim()
  if (cents > 0) w += ' and ' + numWords(cents).trim() + ' Cents'
  return w + ' Only'
}

function newItem(): Item {
  return { id: String(Math.random()), description: '', account_no: '', amount: '' }
}

export default function PettyCashForm({ currentUser, hodName, hasKiscol }: Props) {
  const [isMobile,       setIsMobile]       = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)

  // Determine default form type
  const onlyKiscol = !currentUser.companies.includes('ALL') && currentUser.companies.includes('KISCOL')
  const [formType,  setFormType]  = useState<'kiscol'|'general'>(onlyKiscol ? 'kiscol' : 'general')
  const [company,   setCompany]   = useState(onlyKiscol ? 'Kwale International Sugar Company Ltd (KISCOL)' : '')
  const [reqDate,   setReqDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [idNo,      setIdNo]      = useState('')
  const [items,     setItems]     = useState<Item[]>([newItem(), newItem(), newItem()])
  const [delegate,  setDelegate]  = useState('')
  const [delegateId,setDelegateId]= useState('')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState<{reqNo:string}|null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Lock company when KISCOL form selected
  useEffect(() => {
    if (formType === 'kiscol') setCompany('Kwale International Sugar Company Ltd (KISCOL)')
    else if (onlyKiscol) { /* no-op */ }
  }, [formType, onlyKiscol])

  const total       = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0)
  const wordsAmount = amountInWords(total)

  const updateItem = useCallback((id: string, field: keyof Item, val: string) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it))
  }, [])

  const addItem    = () => setItems(prev => [...prev, newItem()])
  const removeItem = (id: string) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter(it => it.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const validItems = items.filter(it => it.description.trim() && parseFloat(it.amount) > 0)
    if (!company)            { setError('Please select a company.'); return }
    if (!validItems.length)  { setError('Add at least one line item with description and amount.'); return }
    if (total <= 0)          { setError('Total amount must be greater than zero.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/forms/petty-cash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          form_type: formType,
          request_date: reqDate,
          company,
          employee_id_no: idNo,
          items: validItems.map(it => ({
            description: it.description.trim(),
            account_no:  it.account_no.trim(),
            amount:      parseFloat(it.amount) || 0,
          })),
          total_amount:    total,
          amount_in_words: wordsAmount,
          delegate_name:   delegate,
          delegate_id_no:  delegateId,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to submit.'); return }
      setSuccess({ reqNo: data.pcr.req_no })
    } catch { setError('Network error. Please try again.') }
    finally  { setSaving(false) }
  }

  function signOut() {
    fetch('/api/auth/logout', { method: 'POST' }).then(() => { window.location.href = '/login' })
  }

  const initials = currentUser.name.split(/[\s&./]+/).map((w: string) => w[0]).filter(Boolean).join('').toUpperCase().slice(0,2)

  const inputStyle: React.CSSProperties = {
    width:'100%', border:'1px solid #d1d5db', borderRadius:6, padding:'7px 10px',
    fontSize:13, color:'#111827', background:'white', boxSizing:'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display:'block', fontSize:11, fontWeight:600, color:'#374151',
    textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:4,
  }
  const sectionStyle: React.CSSProperties = {
    background:'white', borderRadius:8, padding:'18px 22px', marginBottom:14,
    boxShadow:'0 1px 4px rgba(0,0,0,0.06)',
  }

  if (success) {
    return (
      <div style={{minHeight:'100vh',background:'#f9fafb',display:'flex',flexDirection:'column'}}>
        <NavBar {...{currentUser,isMobile,showMobileMenu,setShowMobileMenu,signOut,initials}}/>
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
          <div style={{background:'white',borderRadius:10,padding:'40px 48px',textAlign:'center',boxShadow:'0 4px 20px rgba(0,0,0,0.08)',maxWidth:440}}>
            <div style={{fontSize:48,marginBottom:16}}>✓</div>
            <div style={{fontSize:20,fontWeight:700,color:'#1a3a2a',marginBottom:4}}>Request Submitted</div>
            <div style={{fontSize:14,color:'#9ca3af',fontWeight:600,marginBottom:12}}>{success.reqNo}</div>
            <p style={{color:'#6b7280',fontSize:14,marginBottom:24,lineHeight:1.6}}>
              {formType === 'kiscol'
                ? 'Your KISCOL petty cash request has been sent to Suresh for review. After his approval, it goes to Ahmad for final sign-off.'
                : 'Your petty cash request has been sent to Krishna for review. After approval, it will go to your HOD, then to Andu (Finance).'}
            </p>
            <p style={{color:'#d97706',fontSize:13,fontWeight:600,marginBottom:24,padding:'10px 14px',background:'#fef3c7',borderRadius:6,lineHeight:1.5}}>
              Reminder: After payment, the legal receipt must be returned to Finance within 48 hours — otherwise it will be recovered from payroll.
            </p>
            <div style={{display:'flex',gap:10,justifyContent:'center'}}>
              <a href="/forms/petty-cash/new" style={{background:'#1a3a2a',color:'white',padding:'10px 20px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:600}}>New Request</a>
              <a href="/forms/petty-cash" style={{background:'#f3f4f6',color:'#374151',padding:'10px 20px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:600}}>View All</a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{minHeight:'100vh',background:'#f3f4f6',display:'flex',flexDirection:'column'}}>
      <NavBar {...{currentUser,isMobile,showMobileMenu,setShowMobileMenu,signOut,initials}}/>

      <div style={{flex:1,maxWidth:800,margin:'0 auto',width:'100%',padding: isMobile ? '16px 12px' : '24px 16px'}}>
        {/* Breadcrumb */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:18,fontSize:13,color:'#6b7280'}}>
          <a href="/forms" style={{color:'#6b7280',textDecoration:'none'}}>Forms</a>
          <span>/</span>
          <a href="/forms/petty-cash" style={{color:'#6b7280',textDecoration:'none'}}>Petty Cash</a>
          <span>/</span>
          <span style={{color:'#111827',fontWeight:600}}>New Request</span>
        </div>

        <div style={{fontSize:18,fontWeight:700,color:'#1a3a2a',marginBottom:2}}>Petty Cash Requisition Form</div>
        <div style={{fontSize:13,color:'#6b7280',marginBottom:18}}>Approved by: Krishna (HOS) → {hodName || 'Your HOD'} → Andu (Finance)</div>

        <form onSubmit={handleSubmit}>
          {/* Form type selection (only for users who have KISCOL access AND are not KISCOL-only) */}
          {hasKiscol && !onlyKiscol && (
            <div style={sectionStyle}>
              <label style={labelStyle}>Form Type</label>
              <div style={{display:'flex',gap:10}}>
                {(['general','kiscol'] as const).map(t => (
                  <label key={t} style={{
                    display:'flex',alignItems:'center',gap:8,padding:'10px 16px',
                    border:`2px solid ${formType===t?'#1a3a2a':'#e5e7eb'}`,borderRadius:6,cursor:'pointer',
                    fontSize:13,fontWeight:formType===t?600:400,
                    background:formType===t?'#f0f4f1':'white',color:formType===t?'#1a3a2a':'#374151',
                  }}>
                    <input type="radio" name="formType" value={t} checked={formType===t}
                      onChange={()=>setFormType(t)} style={{accentColor:'#1a3a2a'}}/>
                    {t === 'general' ? 'General (Pabari Investments)' : 'KISCOL'}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Header row */}
          <div style={sectionStyle}>
            <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',gap:14,marginBottom:14}}>
              <div>
                <label style={labelStyle}>Request Date <span style={{color:'#dc2626'}}>*</span></label>
                <input style={inputStyle} type="date" value={reqDate} onChange={e=>setReqDate(e.target.value)} required />
              </div>
              <div>
                <label style={labelStyle}>Raised By</label>
                <input style={{...inputStyle,background:'#f9fafb',color:'#6b7280'}} value={currentUser.name} disabled />
              </div>
              <div>
                <label style={labelStyle}>ID No. (optional)</label>
                <input style={inputStyle} placeholder="National ID number" value={idNo} onChange={e=>setIdNo(e.target.value)} />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Company <span style={{color:'#dc2626'}}>*</span></label>
              {formType === 'kiscol' ? (
                <input style={{...inputStyle,background:'#f9fafb',color:'#6b7280'}} value={company} disabled />
              ) : (
                <select style={inputStyle} value={company} onChange={e=>setCompany(e.target.value)} required>
                  <option value="">-- Select company --</option>
                  {LEAVE_COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
          </div>

          {/* Line items */}
          <div style={sectionStyle}>
            <div style={{fontSize:14,fontWeight:700,color:'#1a3a2a',marginBottom:14,paddingBottom:10,borderBottom:'1px solid #f0f0f0'}}>
              Description / Reason for Request
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
                <thead>
                  <tr style={{background:'#f9fafb'}}>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:'#374151',borderBottom:'1px solid #e5e7eb',width:'50%'}}>Description / Reason</th>
                    <th style={{padding:'8px 10px',textAlign:'left',fontWeight:600,color:'#374151',borderBottom:'1px solid #e5e7eb',width:'20%'}}>Account No.</th>
                    <th style={{padding:'8px 10px',textAlign:'right',fontWeight:600,color:'#374151',borderBottom:'1px solid #e5e7eb',width:'20%'}}>Amount (KSHS)</th>
                    <th style={{width:'10%',borderBottom:'1px solid #e5e7eb'}}/>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id} style={{borderBottom:'1px solid #f0f0f0'}}>
                      <td style={{padding:'6px 4px'}}>
                        <input style={{...inputStyle,borderRadius:4}} placeholder={`Item ${i+1}`}
                          value={it.description} onChange={e=>updateItem(it.id,'description',e.target.value)} />
                      </td>
                      <td style={{padding:'6px 4px'}}>
                        <input style={{...inputStyle,borderRadius:4}} placeholder="Optional"
                          value={it.account_no} onChange={e=>updateItem(it.id,'account_no',e.target.value)} />
                      </td>
                      <td style={{padding:'6px 4px'}}>
                        <input style={{...inputStyle,borderRadius:4,textAlign:'right'}} placeholder="0.00"
                          type="number" min="0" step="0.01"
                          value={it.amount} onChange={e=>updateItem(it.id,'amount',e.target.value)} />
                      </td>
                      <td style={{padding:'6px 4px',textAlign:'center'}}>
                        <button type="button" onClick={()=>removeItem(it.id)}
                          style={{background:'none',border:'none',color:'#d1d5db',fontSize:16,cursor:'pointer',padding:'0 4px',lineHeight:1}}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{background:'#f9fafb',fontWeight:700}}>
                    <td colSpan={2} style={{padding:'10px 10px',color:'#374151',fontSize:13,textAlign:'right'}}>TOTAL</td>
                    <td style={{padding:'10px 10px',textAlign:'right',color:'#1a3a2a',fontSize:14}}>
                      {total > 0 ? `KSH ${total.toLocaleString('en-KE', {minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'}
                    </td>
                    <td/>
                  </tr>
                </tfoot>
              </table>
            </div>
            <button type="button" onClick={addItem}
              style={{marginTop:10,background:'none',border:'1px dashed #9ca3af',color:'#6b7280',borderRadius:5,padding:'7px 14px',fontSize:13,cursor:'pointer',width:'100%'}}>
              + Add Line Item
            </button>

            {total > 0 && (
              <div style={{marginTop:12,padding:'10px 14px',background:'#f0f4f1',borderRadius:5,border:'1px solid #bbddcc',fontSize:12,color:'#1a3a2a',fontStyle:'italic'}}>
                Amount in words: <strong>{wordsAmount}</strong>
              </div>
            )}
          </div>

          {/* Delegate */}
          <div style={sectionStyle}>
            <div style={{fontSize:14,fontWeight:700,color:'#1a3a2a',marginBottom:12,paddingBottom:10,borderBottom:'1px solid #f0f0f0'}}>
              Delegate (optional)
            </div>
            <div style={{fontSize:13,color:'#6b7280',marginBottom:12}}>
              If someone else will collect the money on your behalf, fill in their details below.
            </div>
            <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',gap:14}}>
              <div>
                <label style={labelStyle}>Delegate Name</label>
                <input style={inputStyle} placeholder="Full name of delegate" value={delegate} onChange={e=>setDelegate(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Delegate ID No.</label>
                <input style={inputStyle} placeholder="National ID number" value={delegateId} onChange={e=>setDelegateId(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Approval chain (read-only preview) */}
          <div style={{...sectionStyle,background:'#f9fafb'}}>
            <div style={{fontSize:14,fontWeight:700,color:'#374151',marginBottom:14}}>Approval Chain</div>
            <div style={{display:'grid',gridTemplateColumns: isMobile ? '1fr 1fr' : formType === 'kiscol' ? 'repeat(3,1fr)' : 'repeat(4,1fr)',gap:10}}>
              {(formType === 'kiscol'
                ? [
                    { label:'Raised By',      name: currentUser.name, role:'Employee' },
                    { label:'Checked By',     name:'Suresh',          role:'KISCOL HOD' },
                    { label:'Final Approval', name:'Ahmad',           role:'KISCOL Head' },
                  ]
                : [
                    { label:'Raised By',              name: currentUser.name,            role:'Employee' },
                    { label:'Checked By HOS',          name:'Krishna',                   role:'Head of Section' },
                    { label:'Verified & Approved By HOD', name: hodName || '(your HOD)', role:'Head of Department' },
                    { label:'Approved By Finance HOD', name:'Andu',                      role:'Finance HOD' },
                  ]
              ).map(step => (
                <div key={step.label} style={{padding:'10px 12px',background:'white',borderRadius:6,border:'1px solid #e5e7eb'}}>
                  <div style={{fontSize:10,color:'#9ca3af',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px',marginBottom:4}}>{step.label}</div>
                  <div style={{fontSize:13,fontWeight:600,color:'#1a3a2a'}}>{step.name}</div>
                  <div style={{fontSize:11,color:'#9ca3af'}}>{step.role}</div>
                </div>
              ))}
            </div>
            <div style={{marginTop:12,padding:'10px 14px',background:'#fef3c7',borderRadius:5,fontSize:12,color:'#92400e',fontWeight:500}}>
              ⚠ After payment is made, the legal receipt must be returned to Finance within 48 hours. Failure will result in recovery from payroll.
            </div>
          </div>

          {error && (
            <div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:6,padding:'12px 16px',marginBottom:14,fontSize:13,color:'#dc2626'}}>
              {error}
            </div>
          )}

          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <a href="/forms/petty-cash" style={{background:'#f3f4f6',color:'#374151',padding:'10px 20px',borderRadius:6,textDecoration:'none',fontSize:14,fontWeight:600,display:'inline-flex',alignItems:'center'}}>Cancel</a>
            <button type="submit" disabled={saving}
              style={{background:'#1a3a2a',color:'white',border:'none',padding:'10px 24px',borderRadius:6,fontSize:14,fontWeight:600,cursor: saving ? 'not-allowed' : 'pointer'}}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NavBar({ currentUser, isMobile, showMobileMenu, setShowMobileMenu, signOut, initials }: {
  currentUser: SessionUser
  isMobile: boolean
  showMobileMenu: boolean
  setShowMobileMenu: (v: boolean) => void
  signOut: () => void
  initials: string
}) {
  return (
    <>
      <div style={{background:'#1a3a2a',padding:'0 14px',display:'flex',alignItems:'center',gap:isMobile?8:12,height:50,flexShrink:0}}>
        <span style={{background:'#b5833a',color:'white',fontWeight:800,fontSize:11,padding:'4px 9px',borderRadius:4,letterSpacing:'1px'}}>PABARI</span>
        {!isMobile && <>
          <span style={{fontSize:13,fontWeight:700,color:'white'}}>PABARI GROUP</span>
          <div style={{width:1,height:20,background:'rgba(255,255,255,0.15)',margin:'0 4px'}}/>
          {currentUser.role !== 'staff' && <a href="/dashboard" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Dashboard</a>}
          <a href="/tasks" style={{color:'rgba(255,255,255,0.6)',textDecoration:'none',fontSize:12}}>Task Board</a>
          <a href="/forms" style={{color:'white',textDecoration:'none',fontSize:12,fontWeight:600,borderBottom:'2px solid #b5833a',paddingBottom:2}}>Forms</a>
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
              {label:'Forms',href:'/forms'},
              ...(currentUser.role !== 'staff' ? [{label:'Reports',href:'/reports'}] : []),
            ].map(item => (
              <a key={item.href} href={item.href} style={{display:'block',padding:'13px 16px',color:'rgba(255,255,255,0.85)',textDecoration:'none',fontSize:14,fontWeight:500,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>{item.label}</a>
            ))}
            <div style={{padding:'10px 12px'}}>
              <button onClick={signOut} style={{background:'rgba(255,255,255,0.08)',color:'rgba(255,255,255,0.8)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:6,padding:'10px 14px',fontSize:13,textAlign:'left',cursor:'pointer',width:'100%'}}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
