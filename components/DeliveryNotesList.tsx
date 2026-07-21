'use client'

import { useState, useEffect, useCallback } from 'react'
import { SessionUser } from '@/types'

type IssuingCompany = 'mercury' | 'bytewise'

interface AnyItem { qty?: string; description: string; item_code?: string }
type MercuryItem  = AnyItem
type BytewiseItem = AnyItem

interface DeliveryNote {
  id: number
  note_number: string
  to_company: string
  order_no: string
  delivery_date: string
  vehicle_no: string
  driver_name: string
  driver_id: string
  gate_pass_number: string
  items: AnyItem[]
  remarks: string
  status: string
  cancel_reason: string
  issuing_company: IssuingCompany
  created_by: string
  created_at: string
}
interface Customer {
  id: number; name: string; contact_person: string; phone: string; address: string; issuing_company: IssuingCompany
}

const TODAY = new Date().toISOString().slice(0, 10)

const GOODS_OPTIONS: Record<IssuingCompany, string[]> = {
  mercury:  ['Soya Beans 50kg', 'Sugar 50kg', 'Biriyani Rice 25kg', '2kg Sugar Bales', '1kg Sugar Bales'],
  bytewise: ['Soya Beans 50kg', 'Sugar 50kg', 'Biriyani Rice 25kg', '2kg Sugar Bales', '1kg Sugar Bales'],
}

const CO_LABEL: Record<IssuingCompany, string> = { mercury: 'Mercury Agencies Limited', bytewise: 'Bytewise Limited' }
const CO_BADGE_BG: Record<IssuingCompany, string> = { mercury: '#3D2314', bytewise: '#1a3a2a' }

function emptyMercuryItems(): MercuryItem[]  { return [{qty:'',description:''},{qty:'',description:''},{qty:'',description:''}] }
function emptyBytewiseItems(): BytewiseItem[] { return [{item_code:'',description:'',qty:''},{item_code:'',description:'',qty:''},{item_code:'',description:'',qty:''}] }

function emptyForm(co: IssuingCompany) {
  return {
    note_number: '', to_company: '', delivery_date: TODAY,
    vehicle_no: '', driver_name: '', driver_id: '', gate_pass_number: '',
    items: co === 'bytewise' ? emptyBytewiseItems() : emptyMercuryItems(),
    remarks: '',
  }
}

export default function DeliveryNotesList({ currentUser }: { currentUser: SessionUser }) {
  const [tab,           setTab]          = useState<'notes'|'customers'>('notes')
  const [coFilter,      setCoFilter]     = useState<IssuingCompany|'all'>('all')

  // ── Notes state ───────────────────────────────────────────────────────────
  const [notes,         setNotes]        = useState<DeliveryNote[]>([])
  const [loading,       setLoading]      = useState(true)
  const [showForm,      setShowForm]     = useState(false)
  const [issuingCo,     setIssuingCo]    = useState<IssuingCompany>('mercury')
  const [form,          setForm]         = useState(emptyForm('mercury'))
  const [editingId,     setEditingId]    = useState<number|null>(null)
  const [saving,        setSaving]       = useState(false)
  const [error,         setError]        = useState('')
  const [search,        setSearch]       = useState('')
  const [deleting,      setDeleting]     = useState<number|null>(null)
  const [cancelId,      setCancelId]     = useState<number|null>(null)
  const [cancelReason,  setCancelReason] = useState('')
  const [cancelling,    setCancelling]   = useState(false)
  const [showCancelled, setShowCancelled]= useState(true)

  // ── Customers state ───────────────────────────────────────────────────────
  const [customers,     setCustomers]    = useState<Customer[]>([])
  const [custLoading,   setCustLoading]  = useState(false)
  const [showCustForm,  setShowCustForm] = useState(false)
  const [editingCust,   setEditingCust]  = useState<Customer|null>(null)
  const [custCo,        setCustCo]       = useState<IssuingCompany>('mercury')
  const [custForm,      setCustForm]     = useState({ name:'', contact_person:'', phone:'', address:'' })
  const [custSaving,    setCustSaving]   = useState(false)
  const [custError,     setCustError]    = useState('')
  const [custSearch,    setCustSearch]   = useState('')
  const [custCoFilter,  setCustCoFilter] = useState<IssuingCompany|'all'>('all')

  const loadNotes = useCallback(async () => {
    setLoading(true)
    try {
      await fetch('/api/delivery-notes/migrate', { method:'POST' })
      const r = await fetch('/api/delivery-notes', { credentials:'include' })
      if (r.ok) { const d = await r.json(); setNotes(d.notes ?? []) }
    } finally { setLoading(false) }
  }, [])

  const loadCustomers = useCallback(async () => {
    setCustLoading(true)
    try {
      const r = await fetch('/api/customers', { credentials:'include' })
      if (r.ok) { const d = await r.json(); setCustomers(d.customers ?? []) }
    } finally { setCustLoading(false) }
  }, [])

  useEffect(() => { loadNotes(); loadCustomers() }, [loadNotes, loadCustomers])

  // ── Items helpers ─────────────────────────────────────────────────────────
  function setItem(i: number, field: string, val: string) {
    setForm(f => { const items = [...f.items] as AnyItem[]; items[i] = { ...items[i], [field]: val }; return { ...f, items } })
  }
  function addRow() {
    setForm(f => ({ ...f, items: [...f.items, issuingCo === 'bytewise' ? {item_code:'',description:'',qty:''} : {qty:'',description:''}] as AnyItem[] }))
  }
  function removeRow(i: number) { setForm(f => ({ ...f, items: f.items.filter((_,idx) => idx!==i) })) }

  // ── Open new form ─────────────────────────────────────────────────────────
  function openNew(co: IssuingCompany) { setIssuingCo(co); setForm(emptyForm(co)); setEditingId(null); setError(''); setShowForm(true) }

  function openEdit(n: DeliveryNote) {
    const co = (n.issuing_company ?? 'mercury') as IssuingCompany
    const items = Array.isArray(n.items) ? n.items : JSON.parse(n.items as unknown as string ?? '[]')
    setIssuingCo(co)
    setForm({
      note_number:   n.note_number    || '',
      to_company:    n.to_company,
      delivery_date: n.delivery_date?.slice(0,10) || TODAY,
      vehicle_no:    n.vehicle_no     || '',
      driver_name:   n.driver_name    || '',
      driver_id:     n.driver_id      || '',
      gate_pass_number: n.gate_pass_number || '',
      items:         items.length ? items : (co==='bytewise' ? emptyBytewiseItems() : emptyMercuryItems()),
      remarks:       n.remarks        || '',
    })
    setEditingId(n.id); setError(''); setShowForm(true)
  }

  // ── Save note ─────────────────────────────────────────────────────────────
  async function save() {
    setError('')
    if (!form.to_company.trim()) { setError('Customer is required'); return }
    if (!form.delivery_date)     { setError('Date is required'); return }
    const filledItems = form.items.filter(it => {
      if (issuingCo === 'bytewise') { return (it.item_code??'').trim()||(it.description??'').trim() }
      else { return (it.qty??'').trim()||(it.description??'').trim() }
    })
    if (!filledItems.length) { setError('At least one item is required'); return }
    setSaving(true)
    try {
      const payload = { ...form, items: filledItems, issuing_company: issuingCo }
      if (editingId) {
        const existing = notes.find(n => n.id === editingId)
        const r = await fetch(`/api/delivery-notes/${editingId}`, { method:'PUT', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ ...payload, note_number: existing?.note_number ?? '' }) })
        const j = await r.json()
        if (!r.ok) { setError(j.error ?? `Save failed (${r.status})`); setSaving(false); return }
        setShowForm(false); setEditingId(null); setForm(emptyForm(issuingCo)); await loadNotes()
      } else {
        await fetch('/api/delivery-notes/migrate', { method:'POST' }).catch(()=>{})
        const r = await fetch('/api/delivery-notes', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(payload) })
        const j = await r.json()
        if (!r.ok) { setError(j.error ?? `Save failed (${r.status})`); setSaving(false); return }
        if (!j.id) { setError('No ID returned'); setSaving(false); return }
        window.location.href = `/delivery-notes/${j.id}`
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error'); setSaving(false)
    }
  }

  async function deleteNote(id: number) {
    if (!confirm('Delete this delivery note?')) return
    setDeleting(id)
    await fetch(`/api/delivery-notes/${id}`, { method:'DELETE', credentials:'include' })
    setDeleting(null); await loadNotes()
  }

  async function confirmCancel() {
    if (!cancelId) return
    setCancelling(true)
    await fetch(`/api/delivery-notes/${cancelId}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ cancel_reason: cancelReason }) })
    setCancelling(false); setCancelId(null); setCancelReason(''); await loadNotes()
  }

  // ── Customer CRUD ─────────────────────────────────────────────────────────
  function openNewCust(co: IssuingCompany) { setCustCo(co); setCustForm({ name:'', contact_person:'', phone:'', address:'' }); setEditingCust(null); setCustError(''); setShowCustForm(true) }
  function openEditCust(c: Customer)       { setCustCo(c.issuing_company); setCustForm({ name:c.name, contact_person:c.contact_person, phone:c.phone, address:c.address }); setEditingCust(c); setCustError(''); setShowCustForm(true) }

  async function saveCust() {
    if (!custForm.name.trim()) { setCustError('Name is required'); return }
    setCustSaving(true); setCustError('')
    try {
      const url    = editingCust ? `/api/customers/${editingCust.id}` : '/api/customers'
      const method = editingCust ? 'PATCH' : 'POST'
      const r = await fetch(url, { method, headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ ...custForm, issuing_company: custCo }) })
      const d = await r.json()
      if (!r.ok) { setCustError(d.error ?? 'Save failed'); return }
      setShowCustForm(false); await loadCustomers()
    } finally { setCustSaving(false) }
  }

  async function deleteCust(id: number) {
    if (!confirm('Delete this customer?')) return
    await fetch(`/api/customers/${id}`, { method:'DELETE', credentials:'include' })
    await loadCustomers()
  }

  // ── Filtered ──────────────────────────────────────────────────────────────
  const filtered = notes.filter(n => {
    if (!showCancelled && n.status==='cancelled') return false
    if (coFilter !== 'all' && (n.issuing_company||'mercury') !== coFilter) return false
    return !search || n.note_number.toLowerCase().includes(search.toLowerCase()) || n.to_company.toLowerCase().includes(search.toLowerCase()) || n.driver_name?.toLowerCase().includes(search.toLowerCase())
  })

  const custsForForm    = customers.filter(c => c.issuing_company === issuingCo)
  const filteredCusts   = customers.filter(c => {
    if (custCoFilter !== 'all' && c.issuing_company !== custCoFilter) return false
    return !custSearch || c.name.toLowerCase().includes(custSearch.toLowerCase()) || c.phone.includes(custSearch)
  })

  const fmtDate = (d: string) => { if (!d) return ''; const p = d.slice(0,10).split('-'); return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:d }
  const inp = { width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box' as const, background:'white' }

  return (
    <div style={{ minHeight:'100vh', background:'#f3f4f6', fontFamily:'system-ui,-apple-system,sans-serif' }}>

      {/* ── HEADER ── */}
      <div style={{ background:'#1a3a2a', padding:'0 32px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <a href="/" style={{ display:'flex', alignItems:'center', textDecoration:'none' }}>
            <div style={{ background:'#b5833a', color:'white', fontWeight:800, fontSize:11, padding:'5px 10px', borderRadius:4, letterSpacing:'1px' }}>PABARI</div>
          </a>
          <div style={{ width:1, height:20, background:'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize:14, fontWeight:700, color:'white' }}>Delivery Notes</span>
          {/* Tab switcher */}
          <div style={{ display:'flex', gap:2, marginLeft:8 }}>
            {([['notes','📄 Notes'],['customers','👥 Customers']] as const).map(([t,label])=>(
              <button key={t} onClick={()=>setTab(t)} style={{ padding:'4px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background:tab===t?'rgba(255,255,255,0.2)':'transparent', color:tab===t?'white':'rgba(255,255,255,0.55)' }}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <a href="/" style={{ fontSize:12, color:'rgba(255,255,255,0.6)', textDecoration:'none', marginRight:4 }}>← Portal</a>
          {tab==='notes' ? (<>
            <button onClick={()=>openNew('mercury')} style={{ background:'#3D2314', color:'white', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Mercury DN</button>
            <button onClick={()=>openNew('bytewise')} style={{ background:'#1a5c3a', color:'white', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Bytewise DN</button>
          </>) : (<>
            <button onClick={()=>openNewCust('mercury')} style={{ background:'#3D2314', color:'white', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Mercury Customer</button>
            <button onClick={()=>openNewCust('bytewise')} style={{ background:'#1a5c3a', color:'white', border:'none', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, cursor:'pointer' }}>+ Bytewise Customer</button>
          </>)}
        </div>
      </div>

      <div style={{ maxWidth:980, margin:'0 auto', padding:'32px 24px' }}>

        {/* ── NOTES TAB ── */}
        {tab==='notes' && (<>
          <div style={{ display:'flex', gap:10, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search note no, company, driver…"
              style={{ flex:1, minWidth:200, padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', background:'white', boxSizing:'border-box' }} />
            {/* Company filter tabs */}
            <div style={{ display:'flex', gap:4 }}>
              {([['all','All'],['mercury','Mercury'],['bytewise','Bytewise']] as const).map(([v,l])=>(
                <button key={v} onClick={()=>setCoFilter(v)} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid #e5e7eb', background:coFilter===v?'#1a3a2a':'white', color:coFilter===v?'white':'#374151', fontSize:12, fontWeight:600, cursor:'pointer' }}>{l}</button>
              ))}
            </div>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#6b7280', cursor:'pointer', whiteSpace:'nowrap' }}>
              <input type="checkbox" checked={showCancelled} onChange={e=>setShowCancelled(e.target.checked)} /> Show cancelled
            </label>
          </div>

          {loading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Loading…</div>
          ) : filtered.length===0 ? (
            <div style={{ textAlign:'center', padding:60, background:'white', borderRadius:12, border:'1px solid #e5e7eb' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>📄</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>{search?'No results':'No delivery notes yet'}</div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {filtered.map(n => {
                const isCancelled = n.status==='cancelled'
                const co = (n.issuing_company||'mercury') as IssuingCompany
                return (
                  <div key={n.id} style={{ background:isCancelled?'#fafafa':'white', border:`1px solid ${isCancelled?'#fecaca':'#e5e7eb'}`, borderRadius:10, padding:'14px 20px', display:'flex', alignItems:'center', gap:16, opacity:isCancelled?0.75:1 }}>
                    <div style={{ width:48, height:48, borderRadius:10, background:CO_BADGE_BG[co], display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:9, fontWeight:800, color:'white', letterSpacing:.5 }}>{co==='bytewise'?'BW':'MAL'}</span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginTop:1 }}>DN {n.note_number}</span>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:isCancelled?'#6b7280':'#111827', textDecoration:isCancelled?'line-through':'none' }}>{n.to_company}</span>
                        {isCancelled && <span style={{ fontSize:10, fontWeight:800, color:'#dc2626', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:4, padding:'1px 7px' }}>CANCELLED</span>}
                      </div>
                      <div style={{ fontSize:12, color:'#9ca3af', marginTop:2 }}>
                        {fmtDate(n.delivery_date)}{n.vehicle_no&&` · ${n.vehicle_no}`}{n.driver_name&&` · ${n.driver_name}`}
                        <span style={{ marginLeft:8, fontSize:10, background:'#f3f4f6', borderRadius:4, padding:'1px 6px', color:'#6b7280', fontWeight:600 }}>{CO_LABEL[co]}</span>
                        {isCancelled&&n.cancel_reason&&<span style={{ marginLeft:8, fontStyle:'italic' }}>· {n.cancel_reason}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, flexShrink:0 }}>
                      <a href={`/delivery-notes/${n.id}`} style={{ background:'#1a3a2a', color:'white', borderRadius:7, padding:'7px 14px', fontSize:12, fontWeight:600, textDecoration:'none' }}>View / Print</a>
                      {!isCancelled&&<button onClick={()=>openEdit(n)} style={{ background:'transparent', border:'1px solid #d1d5db', color:'#374151', borderRadius:7, padding:'7px 12px', fontSize:12, cursor:'pointer', fontWeight:600 }}>Edit</button>}
                      {!isCancelled&&<button onClick={()=>{setCancelId(n.id);setCancelReason('')}} style={{ background:'transparent', border:'1px solid #fed7aa', color:'#c2410c', borderRadius:7, padding:'7px 12px', fontSize:12, cursor:'pointer', fontWeight:600 }}>Cancel</button>}
                      <button onClick={()=>deleteNote(n.id)} disabled={deleting===n.id} style={{ background:'transparent', border:'1px solid #fecaca', color:'#dc2626', borderRadius:7, padding:'7px 12px', fontSize:12, cursor:'pointer' }}>{deleting===n.id?'…':'Delete'}</button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>)}

        {/* ── CUSTOMERS TAB ── */}
        {tab==='customers' && (<>
          <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
            <input value={custSearch} onChange={e=>setCustSearch(e.target.value)} placeholder="Search customers…"
              style={{ flex:1, minWidth:200, padding:'10px 14px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', background:'white', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:4 }}>
              {([['all','All'],['mercury','Mercury'],['bytewise','Bytewise']] as const).map(([v,l])=>(
                <button key={v} onClick={()=>setCustCoFilter(v)} style={{ padding:'7px 14px', borderRadius:7, border:'1px solid #e5e7eb', background:custCoFilter===v?'#1a3a2a':'white', color:custCoFilter===v?'white':'#374151', fontSize:12, fontWeight:600, cursor:'pointer' }}>{l}</button>
              ))}
            </div>
          </div>
          {custLoading ? (
            <div style={{ textAlign:'center', padding:60, color:'#9ca3af' }}>Loading…</div>
          ) : filteredCusts.length===0 ? (
            <div style={{ textAlign:'center', padding:60, background:'white', borderRadius:12, border:'1px solid #e5e7eb' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
              <div style={{ fontSize:15, fontWeight:700, color:'#374151' }}>{custSearch?'No results':'No customers yet'}</div>
            </div>
          ) : (
            <div style={{ background:'white', borderRadius:12, border:'1px solid #e5e7eb', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr style={{ borderBottom:'2px solid #e5e7eb', background:'#f9fafb' }}>
                  {['Company','Customer Name','Contact Person','Phone','Address',''].map(h=>(
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase', letterSpacing:'.5px' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {filteredCusts.map(c=>(
                    <tr key={c.id} style={{ borderBottom:'1px solid #f3f4f6' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='#f9fafb'}
                      onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=''}>
                      <td style={{ padding:'12px 16px' }}><span style={{ fontSize:10, fontWeight:700, background:CO_BADGE_BG[c.issuing_company], color:'white', padding:'2px 7px', borderRadius:4 }}>{CO_LABEL[c.issuing_company]}</span></td>
                      <td style={{ padding:'12px 16px', fontWeight:600, fontSize:13 }}>{c.name}</td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#6b7280' }}>{c.contact_person||'—'}</td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#6b7280' }}>{c.phone||'—'}</td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:'#6b7280' }}>{c.address||'—'}</td>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <button onClick={()=>openEditCust(c)} style={{ padding:'4px 10px', borderRadius:6, border:'1px solid #e5e7eb', background:'white', fontSize:12, cursor:'pointer', fontWeight:600 }}>Edit</button>
                          <button onClick={()=>deleteCust(c.id)} style={{ padding:'4px 10px', borderRadius:6, border:'none', background:'#fee2e2', color:'#dc2626', fontSize:12, cursor:'pointer' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>)}
      </div>

      {/* ── CANCEL MODAL ── */}
      {cancelId!==null && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:60, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:14, width:'100%', maxWidth:440, padding:32 }}>
            <div style={{ fontSize:18, fontWeight:800, marginBottom:6 }}>Cancel Delivery Note</div>
            <div style={{ fontSize:13, color:'#6b7280', marginBottom:20 }}>Kept for audit. Record will be marked cancelled.</div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:6 }}>Reason <span style={{ color:'#9ca3af', fontWeight:400 }}>(optional)</span></label>
            <textarea value={cancelReason} onChange={e=>setCancelReason(e.target.value)} rows={3} autoFocus placeholder="e.g. Goods returned…"
              style={{ width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box', marginBottom:20 }} />
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>{setCancelId(null);setCancelReason('')}} style={{ background:'transparent', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 20px', fontSize:13, color:'#374151', cursor:'pointer' }}>Keep Active</button>
              <button onClick={confirmCancel} disabled={cancelling} style={{ background:cancelling?'#9ca3af':'#dc2626', color:'white', border:'none', borderRadius:8, padding:'10px 24px', fontSize:13, fontWeight:700, cursor:cancelling?'default':'pointer' }}>{cancelling?'Cancelling…':'Confirm Cancellation'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── NOTE FORM MODAL ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'24px 16px', overflowY:'auto' }}>
          <div style={{ background:'white', borderRadius:14, width:'100%', maxWidth:720, padding:32, position:'relative' }}>
            <button onClick={()=>{setShowForm(false);setEditingId(null)}} style={{ position:'absolute', top:16, right:16, background:'transparent', border:'none', fontSize:20, cursor:'pointer', color:'#6b7280' }}>✕</button>

            {/* Company badge header */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24, padding:'12px 16px', background:issuingCo==='bytewise'?'#f0fdf4':'#fef6ee', borderRadius:10, border:`1px solid ${issuingCo==='bytewise'?'#86efac':'#f6c89f'}` }}>
              <div style={{ width:40, height:40, borderRadius:8, background:CO_BADGE_BG[issuingCo], display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:11, fontWeight:800 }}>{issuingCo==='bytewise'?'BW':'MAL'}</div>
              <div>
                <div style={{ fontSize:15, fontWeight:800 }}>{editingId?'Edit':'New'} Delivery Note</div>
                <div style={{ fontSize:11, fontWeight:700, color:CO_BADGE_BG[issuingCo] }}>{CO_LABEL[issuingCo]}</div>
              </div>
            </div>

            {/* Row 1 — Note No + Date */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <Field label="Delivery Note No *" value={form.note_number} onChange={v=>setForm(f=>({...f,note_number:v}))} placeholder="e.g. 1752" />
              <Field label="Date *" type="date" value={form.delivery_date} onChange={v=>setForm(f=>({...f,delivery_date:v}))} />
            </div>

            {/* Customer dropdown */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Customer *</label>
              <select value={form.to_company} onChange={e=>setForm(f=>({...f,to_company:e.target.value}))} style={{ ...inp, color:form.to_company?'#111827':'#9ca3af' }}>
                <option value="">— Select customer —</option>
                {custsForForm.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
              {custsForForm.length===0&&<div style={{ fontSize:11, color:'#b45309', marginTop:4 }}>No {CO_LABEL[issuingCo]} customers yet — <button type="button" onClick={()=>{setShowForm(false);setTab('customers')}} style={{ background:'none',border:'none',color:'#b45309',textDecoration:'underline',cursor:'pointer',fontSize:11,padding:0 }}>add one in Customers tab</button></div>}
            </div>

            {/* Driver fields */}
            {issuingCo==='mercury' ? (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20 }}>
                <Field label="Vehicle No" value={form.vehicle_no} onChange={v=>setForm(f=>({...f,vehicle_no:v}))} placeholder="e.g. KDH M37" />
                <Field label="Driver Name" value={form.driver_name} onChange={v=>setForm(f=>({...f,driver_name:v}))} placeholder="Full name" />
                <Field label="Driver ID" value={form.driver_id} onChange={v=>setForm(f=>({...f,driver_id:v}))} placeholder="ID No" />
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, marginBottom:20 }}>
                <Field label="Vehicle No" value={form.vehicle_no} onChange={v=>setForm(f=>({...f,vehicle_no:v}))} placeholder="e.g. KBZ 123A" />
                <Field label="Gate Pass No" value={form.gate_pass_number} onChange={v=>setForm(f=>({...f,gate_pass_number:v}))} placeholder="Pass No" />
                <Field label="Driver Name" value={form.driver_name} onChange={v=>setForm(f=>({...f,driver_name:v}))} placeholder="Full name" />
                <Field label="Driver ID" value={form.driver_id} onChange={v=>setForm(f=>({...f,driver_id:v}))} placeholder="ID No" />
              </div>
            )}

            {/* Items table */}
            <div style={{ marginBottom:20 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#374151', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Goods Items</div>
              <div style={{ border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden' }}>
                {issuingCo==='mercury' ? (<>
                  <div style={{ display:'grid', gridTemplateColumns:'100px 1fr 32px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    <div style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>Quantity</div>
                    <div style={{ padding:'8px 12px', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>Goods Description</div>
                    <div/>
                  </div>
                  {form.items.map((item, i) => {
                    const m = item as MercuryItem
                    return (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'100px 1fr 32px', borderBottom:i<form.items.length-1?'1px solid #f3f4f6':undefined }}>
                        <input value={m.qty??''} onChange={e=>setItem(i,'qty',e.target.value)} placeholder="Qty"
                          style={{ padding:'9px 12px', border:'none', borderRight:'1px solid #f3f4f6', outline:'none', fontSize:13, background:'transparent' }} />
                        <GoodsSelect value={m.description} onChange={v=>setItem(i,'description',v)} options={GOODS_OPTIONS[issuingCo]} />
                        <button onClick={()=>removeRow(i)} style={{ border:'none', background:'transparent', cursor:'pointer', color:'#d1d5db', fontSize:16, padding:0 }}>×</button>
                      </div>
                    )
                  })}
                </>) : (<>
                  <div style={{ display:'grid', gridTemplateColumns:'40px 120px 1fr 80px 32px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb' }}>
                    {['S.No','Item Code','Description','Qty',''].map(h=><div key={h} style={{ padding:'8px 10px', fontSize:11, fontWeight:700, color:'#6b7280', textTransform:'uppercase' }}>{h}</div>)}
                  </div>
                  {form.items.map((item, i) => {
                    const b = item as BytewiseItem
                    return (
                      <div key={i} style={{ display:'grid', gridTemplateColumns:'40px 120px 1fr 80px 32px', borderBottom:i<form.items.length-1?'1px solid #f3f4f6':undefined }}>
                        <div style={{ padding:'9px 10px', fontSize:13, color:'#9ca3af', borderRight:'1px solid #f3f4f6', display:'flex', alignItems:'center' }}>{i+1}</div>
                        <input value={b.item_code??''} onChange={e=>setItem(i,'item_code',e.target.value)} placeholder="Code"
                          style={{ padding:'9px 10px', border:'none', borderRight:'1px solid #f3f4f6', outline:'none', fontSize:13, background:'transparent' }} />
                        <div style={{ borderRight:'1px solid #f3f4f6' }}>
                          <GoodsSelect value={b.description} onChange={v=>setItem(i,'description',v)} options={GOODS_OPTIONS[issuingCo]} />
                        </div>
                        <input value={b.qty??''} onChange={e=>setItem(i,'qty',e.target.value)} placeholder="Qty"
                          style={{ padding:'9px 10px', border:'none', borderRight:'1px solid #f3f4f6', outline:'none', fontSize:13, background:'transparent' }} />
                        <button onClick={()=>removeRow(i)} style={{ border:'none', background:'transparent', cursor:'pointer', color:'#d1d5db', fontSize:16, padding:0 }}>×</button>
                      </div>
                    )
                  })}
                </>)}
              </div>
              <button onClick={addRow} style={{ marginTop:8, background:'transparent', border:'1px dashed #d1d5db', borderRadius:6, padding:'6px 14px', fontSize:12, color:'#6b7280', cursor:'pointer', width:'100%' }}>+ Add row</button>
            </div>

            {/* Remarks (Mercury only) */}
            {issuingCo==='mercury' && (
              <div style={{ marginBottom:24 }}>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Remarks</label>
                <textarea value={form.remarks} onChange={e=>setForm(f=>({...f,remarks:e.target.value}))} rows={2} placeholder="Any additional notes (optional)"
                  style={{ width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
            )}

            {error&&<div style={{ background:'#fef2f2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#dc2626', marginBottom:12 }}>⚠ {error}</div>}

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>{setShowForm(false);setEditingId(null)}} style={{ background:'transparent', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 20px', fontSize:13, color:'#374151', cursor:'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ background:saving?'#9ca3af':'#1a3a2a', color:'white', border:'none', borderRadius:8, padding:'10px 24px', fontSize:13, fontWeight:700, cursor:saving?'default':'pointer' }}>
                {saving?'Saving…':editingId?'Save Changes':'Save & Preview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMER FORM MODAL ── */}
      {showCustForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:14, width:'100%', maxWidth:480, padding:32, position:'relative' }}>
            <button onClick={()=>setShowCustForm(false)} style={{ position:'absolute', top:16, right:16, background:'transparent', border:'none', fontSize:20, cursor:'pointer', color:'#6b7280' }}>✕</button>
            <div style={{ fontSize:16, fontWeight:800, marginBottom:4 }}>{editingCust?'Edit':'Add'} Customer</div>
            <div style={{ fontSize:11, fontWeight:700, color:CO_BADGE_BG[custCo], marginBottom:20 }}>{CO_LABEL[custCo]}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <Field label="Customer Name *" value={custForm.name} onChange={v=>setCustForm(f=>({...f,name:v}))} placeholder="e.g. Pembe Flour Mills Ltd" />
              <Field label="Contact Person" value={custForm.contact_person} onChange={v=>setCustForm(f=>({...f,contact_person:v}))} placeholder="Full name" />
              <Field label="Phone" value={custForm.phone} onChange={v=>setCustForm(f=>({...f,phone:v}))} placeholder="+254 700 000 000" />
              <div>
                <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>Address</label>
                <textarea value={custForm.address} onChange={e=>setCustForm(f=>({...f,address:e.target.value}))} rows={2} placeholder="Physical address (optional)"
                  style={{ width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }} />
              </div>
            </div>
            {custError&&<div style={{ color:'#dc2626', fontSize:13, marginTop:12 }}>{custError}</div>}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:24 }}>
              <button onClick={()=>setShowCustForm(false)} style={{ background:'transparent', border:'1px solid #e5e7eb', borderRadius:8, padding:'10px 20px', fontSize:13, color:'#374151', cursor:'pointer' }}>Cancel</button>
              <button onClick={saveCust} disabled={custSaving} style={{ background:custSaving?'#9ca3af':'#1a3a2a', color:'white', border:'none', borderRadius:8, padding:'10px 24px', fontSize:13, fontWeight:700, cursor:custSaving?'default':'pointer' }}>
                {custSaving?'Saving…':editingCust?'Save Changes':'Add Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function GoodsSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const isCustom = value!==''&&!options.includes(value)
  const [showCustom, setShowCustom] = useState(isCustom)
  function handleSelect(v: string) {
    if (v==='__custom__') { setShowCustom(true); onChange('') }
    else { setShowCustom(false); onChange(v) }
  }
  if (options.length===0) {
    return <input value={value} onChange={e=>onChange(e.target.value)} placeholder="Description"
      style={{ padding:'9px 12px', border:'none', outline:'none', fontSize:13, background:'transparent', width:'100%', boxSizing:'border-box' }} />
  }
  return (
    <div style={{ display:'flex', flexDirection:'column' }}>
      <select value={showCustom?'__custom__':value} onChange={e=>handleSelect(e.target.value)}
        style={{ padding:'9px 12px', border:'none', outline:'none', fontSize:13, background:'transparent', width:'100%' }}>
        <option value="">— Select goods —</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
        <option value="__custom__">Other / Custom…</option>
      </select>
      {showCustom&&<input autoFocus value={value} onChange={e=>onChange(e.target.value)} placeholder="Type description…"
        style={{ padding:'6px 12px', border:'none', borderTop:'1px solid #f3f4f6', outline:'none', fontSize:13, background:'#fafafa' }} />}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type='text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{ width:'100%', padding:'9px 12px', border:'1px solid #e5e7eb', borderRadius:8, fontSize:13, outline:'none', boxSizing:'border-box', background:'white' }} />
    </div>
  )
}
