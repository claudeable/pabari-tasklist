'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Invoice, DeliveryNote, InvoiceItem, InvoiceStatus, DocType, SessionUser } from '@/types'
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLE, COMPANIES } from '@/types'

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt  = (n: number) => 'KES ' + n.toLocaleString('en-KE', { minimumFractionDigits: 2 })
const fmtD = (s: string) => s ? new Date(s + 'T00:00:00').toLocaleDateString('en-KE', { day:'2-digit', month:'short', year:'numeric' }) : '—'

const DOC_LABEL: Record<DocType, string> = { quotation: 'Quotation', invoice: 'Invoice', lpo: 'LPO' }
const DOC_COLOR: Record<DocType, { bg: string; color: string }> = {
  quotation: { bg: '#ede9fe', color: '#6d28d9' },
  invoice:   { bg: '#dbeafe', color: '#1d4ed8' },
  lpo:       { bg: '#fef9c3', color: '#92400e' },
}

const BLANK_ITEM: InvoiceItem = { description: '', qty: 1, unit_price: 0, amount: 0 }
const TAX_RATE_DEFAULT = 16

function blankForm(type: DocType = 'invoice') {
  return {
    type,
    issuing_company: '',
    client_name: '', client_address: '', client_email: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '', validity_date: '',
    items: [{ ...BLANK_ITEM }] as InvoiceItem[],
    subtotal: 0, tax_rate: TAX_RATE_DEFAULT, tax_amount: 0, total: 0,
    notes: '', terms: '',
    project_id: null as number | null,
  }
}

function calcTotals(items: InvoiceItem[], taxRate: number) {
  const sub = items.reduce((s, it) => s + it.amount, 0)
  const tax = +(sub * taxRate / 100).toFixed(2)
  return { subtotal: sub, tax_amount: tax, total: +(sub + tax).toFixed(2) }
}

// ─── status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STATUS_STYLE[status]
  return (
    <span style={{ background:s.bg, color:s.color, borderRadius:12, padding:'2px 10px', fontSize:11, fontWeight:600 }}>
      {INVOICE_STATUS_LABELS[status]}
    </span>
  )
}

function DocBadge({ type }: { type: DocType }) {
  const s = DOC_COLOR[type]
  return (
    <span style={{ background:s.bg, color:s.color, borderRadius:12, padding:'2px 9px', fontSize:10, fontWeight:700, letterSpacing:'0.03em' }}>
      {DOC_LABEL[type]}
    </span>
  )
}

// ─── line item editor ─────────────────────────────────────────────────────────
function ItemsEditor({ items, onChange, readonly }: {
  items: InvoiceItem[]; onChange: (i: InvoiceItem[]) => void; readonly?: boolean
}) {
  function update(idx: number, field: keyof InvoiceItem, val: string | number) {
    const next = items.map((it, i) => {
      if (i !== idx) return it
      const upd = { ...it, [field]: val }
      if (field === 'qty' || field === 'unit_price') {
        upd.amount = +(Number(upd.qty) * Number(upd.unit_price)).toFixed(2)
      }
      if (field === 'amount') {
        upd.unit_price = upd.qty ? +(Number(val) / Number(upd.qty)).toFixed(4) : 0
      }
      return upd
    })
    onChange(next)
  }
  function addRow()      { onChange([...items, { ...BLANK_ITEM }]) }
  function remove(idx: number) { onChange(items.filter((_, i) => i !== idx)) }

  const thStyle: React.CSSProperties = { padding:'5px 8px', textAlign:'left', fontSize:11, color:'#6b7280', fontWeight:600, borderBottom:'1px solid #e5e7eb' }
  const tdStyle: React.CSSProperties = { padding:'4px 4px' }
  const inp = (style?: React.CSSProperties): React.CSSProperties => ({
    width:'100%', border:'1px solid #e5e7eb', borderRadius:4, padding:'4px 6px', fontSize:12, background: readonly?'#f9fafb':'white', ...style
  })

  return (
    <div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width:'40%' }}>Description</th>
              <th style={{ ...thStyle, width:60 }}>Qty</th>
              <th style={{ ...thStyle, width:110 }}>Unit Price</th>
              <th style={{ ...thStyle, width:110 }}>Amount</th>
              {!readonly && <th style={{ ...thStyle, width:30 }}/>}
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx} style={{ borderBottom:'1px solid #f3f4f6' }}>
                <td style={tdStyle}>
                  <input disabled={readonly} value={it.description} onChange={e=>update(idx,'description',e.target.value)}
                    style={inp()} placeholder="Description" />
                </td>
                <td style={tdStyle}>
                  <input disabled={readonly} type="number" min={1} value={it.qty} onChange={e=>update(idx,'qty',Number(e.target.value))}
                    style={inp({ textAlign:'center' })} />
                </td>
                <td style={tdStyle}>
                  <input disabled={readonly} type="number" min={0} step="0.01" value={it.unit_price} onChange={e=>update(idx,'unit_price',Number(e.target.value))}
                    style={inp({ textAlign:'right' })} />
                </td>
                <td style={tdStyle}>
                  <input disabled={readonly} type="number" min={0} step="0.01" value={it.amount} onChange={e=>update(idx,'amount',Number(e.target.value))}
                    style={inp({ textAlign:'right' })} />
                </td>
                {!readonly && (
                  <td style={tdStyle}>
                    {items.length > 1 && (
                      <button onClick={()=>remove(idx)} style={{ border:'none', background:'transparent', cursor:'pointer', color:'#dc2626', fontSize:16, padding:'0 2px', lineHeight:1 }}>×</button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readonly && (
        <button onClick={addRow} style={{ marginTop:6, fontSize:12, color:'#1a3a2a', background:'transparent', border:'1px dashed #9ca3af', borderRadius:4, padding:'4px 12px', cursor:'pointer', width:'100%' }}>
          + Add line item
        </button>
      )}
    </div>
  )
}

// ─── print view ───────────────────────────────────────────────────────────────
function PrintPreview({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  useEffect(() => {
    const orig = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = orig }
  }, [])

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'white', borderRadius:12, maxWidth:760, width:'100%', maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Toolbar */}
        <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 20px', borderBottom:'1px solid #e5e7eb', background:'#f9fafb', borderRadius:'12px 12px 0 0' }}>
          <span style={{ fontWeight:700, fontSize:14 }}>Preview — {inv.doc_no}</span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={()=>window.print()} style={{ background:'#1a3a2a', color:'white', border:'none', borderRadius:6, padding:'6px 16px', fontSize:12, cursor:'pointer', fontWeight:600 }}>🖨 Print</button>
            <button onClick={onClose} style={{ background:'#f3f4f6', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer' }}>✕ Close</button>
          </div>
        </div>

        {/* Document */}
        <div id="print-area" style={{ padding:'40px 50px', fontFamily:'Georgia, serif', fontSize:13, lineHeight:1.6, color:'#1a1a1a' }}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:32 }}>
            <div>
              <div style={{ fontSize:22, fontWeight:700, color:'#1a3a2a', letterSpacing:'-0.02em' }}>{inv.issuing_company}</div>
              <div style={{ fontSize:11, color:'#6b7280', marginTop:2 }}>Pabari Group of Companies · Nairobi, Kenya</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:22, fontWeight:700, color:'#374151', letterSpacing:'0.05em' }}>{DOC_LABEL[inv.type]}</div>
              <div style={{ fontSize:13, color:'#6b7280', marginTop:2 }}>{inv.doc_no}</div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height:2, background:'linear-gradient(90deg,#1a3a2a,#2d6a4f)', marginBottom:28 }}/>

          {/* Bill to / dates */}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:28 }}>
            <div>
              <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>Bill To</div>
              <div style={{ fontWeight:700, fontSize:14 }}>{inv.client_name}</div>
              {inv.client_address && <div style={{ fontSize:12, color:'#6b7280', whiteSpace:'pre-line' }}>{inv.client_address}</div>}
              {inv.client_email   && <div style={{ fontSize:12, color:'#6b7280' }}>{inv.client_email}</div>}
            </div>
            <div style={{ textAlign:'right', fontSize:12 }}>
              <table style={{ borderCollapse:'collapse' }}>
                <tbody>
                  <tr><td style={{ padding:'2px 8px 2px 0', color:'#9ca3af', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Issue Date</td><td style={{ padding:'2px 0' }}>{fmtD(inv.issue_date)}</td></tr>
                  {inv.due_date      && <tr><td style={{ padding:'2px 8px 2px 0', color:'#9ca3af', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Due Date</td><td>{fmtD(inv.due_date)}</td></tr>}
                  {inv.validity_date && <tr><td style={{ padding:'2px 8px 2px 0', color:'#9ca3af', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.05em' }}>Valid Until</td><td>{fmtD(inv.validity_date)}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* Items table */}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:20 }}>
            <thead>
              <tr style={{ background:'#1a3a2a', color:'white' }}>
                <th style={{ padding:'8px 12px', textAlign:'left',  fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' }}>#</th>
                <th style={{ padding:'8px 12px', textAlign:'left',  fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' }}>Description</th>
                <th style={{ padding:'8px 12px', textAlign:'right', fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' }}>Qty</th>
                <th style={{ padding:'8px 12px', textAlign:'right', fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' }}>Unit Price</th>
                <th style={{ padding:'8px 12px', textAlign:'right', fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, i) => (
                <tr key={i} style={{ background: i%2===0 ? 'white' : '#f9fafb', borderBottom:'1px solid #f3f4f6' }}>
                  <td style={{ padding:'8px 12px', fontSize:12 }}>{i+1}</td>
                  <td style={{ padding:'8px 12px', fontSize:12 }}>{it.description}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12 }}>{it.qty}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12 }}>{it.unit_price.toLocaleString('en-KE', { minimumFractionDigits:2 })}</td>
                  <td style={{ padding:'8px 12px', textAlign:'right', fontSize:12, fontWeight:600 }}>{it.amount.toLocaleString('en-KE', { minimumFractionDigits:2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:28 }}>
            <table style={{ borderCollapse:'collapse', minWidth:240 }}>
              <tbody>
                <tr>
                  <td style={{ padding:'4px 12px', fontSize:12, color:'#6b7280', textAlign:'right' }}>Subtotal</td>
                  <td style={{ padding:'4px 12px', fontSize:12, textAlign:'right', fontWeight:600 }}>{inv.subtotal.toLocaleString('en-KE', { minimumFractionDigits:2 })}</td>
                </tr>
                <tr>
                  <td style={{ padding:'4px 12px', fontSize:12, color:'#6b7280', textAlign:'right' }}>VAT ({inv.tax_rate}%)</td>
                  <td style={{ padding:'4px 12px', fontSize:12, textAlign:'right', fontWeight:600 }}>{inv.tax_amount.toLocaleString('en-KE', { minimumFractionDigits:2 })}</td>
                </tr>
                <tr style={{ background:'#1a3a2a', color:'white' }}>
                  <td style={{ padding:'8px 12px', fontSize:13, fontWeight:700, textAlign:'right' }}>TOTAL (KES)</td>
                  <td style={{ padding:'8px 12px', fontSize:13, fontWeight:700, textAlign:'right' }}>{inv.total.toLocaleString('en-KE', { minimumFractionDigits:2 })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Notes / Terms */}
          {(inv.notes || inv.terms) && (
            <div style={{ display:'grid', gridTemplateColumns:inv.notes&&inv.terms?'1fr 1fr':'1fr', gap:20, marginBottom:24 }}>
              {inv.notes && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>Notes</div>
                  <div style={{ fontSize:12, color:'#4b5563', whiteSpace:'pre-line' }}>{inv.notes}</div>
                </div>
              )}
              {inv.terms && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, color:'#9ca3af', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:4 }}>Terms &amp; Conditions</div>
                  <div style={{ fontSize:12, color:'#4b5563', whiteSpace:'pre-line' }}>{inv.terms}</div>
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop:'2px solid #1a3a2a', paddingTop:12, fontSize:10, color:'#9ca3af', textAlign:'center' }}>
            This document was generated by Pabari Group ERP · {new Date().toLocaleDateString('en-KE',{day:'2-digit',month:'long',year:'numeric'})}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── create / edit form ───────────────────────────────────────────────────────
function InvoiceForm({ initial, onSave, onCancel, saving }: {
  initial: ReturnType<typeof blankForm> & Partial<Invoice>
  onSave: (d: ReturnType<typeof blankForm>) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState({ ...initial })
  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }
  function updateItems(items: InvoiceItem[]) {
    const { subtotal, tax_amount, total } = calcTotals(items, form.tax_rate)
    setForm(f => ({ ...f, items, subtotal, tax_amount, total }))
  }
  function updateTax(rate: number) {
    const { subtotal, tax_amount, total } = calcTotals(form.items, rate)
    setForm(f => ({ ...f, tax_rate: rate, subtotal, tax_amount, total }))
  }
  const label = (s: string) => <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#6b7280', marginBottom:3, textTransform:'uppercase', letterSpacing:'0.04em' }}>{s}</label>
  const inp  = { border:'1px solid #e5e7eb', borderRadius:6, padding:'7px 10px', fontSize:13, width:'100%', boxSizing:'border-box' as const }
  const grid = (cols: string) => ({ display:'grid', gridTemplateColumns:cols, gap:12, marginBottom:14 })

  return (
    <div style={{ padding:'20px 24px', overflowY:'auto', maxHeight:'calc(90vh - 60px)' }}>
      {/* Type */}
      <div style={{ marginBottom:14 }}>
        {label('Document type')}
        <div style={{ display:'flex', gap:8 }}>
          {(['invoice','quotation','lpo'] as DocType[]).map(t => (
            <button key={t} onClick={()=>set('type',t)}
              style={{ border:`2px solid ${form.type===t?'#1a3a2a':'#e5e7eb'}`, borderRadius:8, padding:'6px 18px', fontSize:12, fontWeight:600, cursor:'pointer', background:form.type===t?'#1a3a2a':'white', color:form.type===t?'white':'#374151' }}>
              {DOC_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <div style={grid('1fr 1fr')}>
        <div>
          {label('Issuing company *')}
          <select value={form.issuing_company} onChange={e=>set('issuing_company',e.target.value)} style={inp}>
            <option value="">— select company —</option>
            {COMPANIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          {label('Client name *')}
          <input value={form.client_name} onChange={e=>set('client_name',e.target.value)} style={inp} placeholder="e.g. Safaricom PLC" />
        </div>
      </div>

      <div style={grid('1fr 1fr')}>
        <div>
          {label('Client address')}
          <textarea value={form.client_address} onChange={e=>set('client_address',e.target.value)} rows={2}
            style={{ ...inp, resize:'vertical' }} placeholder="P.O Box / Street address" />
        </div>
        <div>
          {label('Client email')}
          <input type="email" value={form.client_email} onChange={e=>set('client_email',e.target.value)} style={inp} placeholder="client@example.com" />
        </div>
      </div>

      <div style={grid('1fr 1fr 1fr')}>
        <div>
          {label('Issue date')}
          <input type="date" value={form.issue_date} onChange={e=>set('issue_date',e.target.value)} style={inp} />
        </div>
        {form.type !== 'lpo' && (
          <div>
            {label(form.type==='quotation' ? 'Valid until' : 'Due date')}
            <input type="date" value={form.type==='quotation'?form.validity_date:form.due_date}
              onChange={e=>form.type==='quotation'?set('validity_date',e.target.value):set('due_date',e.target.value)} style={inp} />
          </div>
        )}
        <div>
          {label('VAT %')}
          <input type="number" min={0} max={100} step="0.1" value={form.tax_rate} onChange={e=>updateTax(Number(e.target.value))} style={inp} />
        </div>
      </div>

      {/* Items */}
      <div style={{ marginBottom:14 }}>
        {label('Line items *')}
        <ItemsEditor items={form.items} onChange={updateItems} />
      </div>

      {/* Totals */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:18 }}>
        <div style={{ minWidth:220, border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden', fontSize:13 }}>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 14px', background:'#f9fafb' }}>
            <span style={{ color:'#6b7280' }}>Subtotal</span>
            <span style={{ fontWeight:600 }}>{fmt(form.subtotal)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 14px', background:'#f9fafb', borderTop:'1px solid #e5e7eb' }}>
            <span style={{ color:'#6b7280' }}>VAT ({form.tax_rate}%)</span>
            <span style={{ fontWeight:600 }}>{fmt(form.tax_amount)}</span>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', background:'#1a3a2a', color:'white' }}>
            <span style={{ fontWeight:700 }}>Total</span>
            <span style={{ fontWeight:700 }}>{fmt(form.total)}</span>
          </div>
        </div>
      </div>

      <div style={grid('1fr 1fr')}>
        <div>
          {label('Notes')}
          <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={3}
            style={{ ...inp, resize:'vertical' }} placeholder="Payment instructions, bank details, etc." />
        </div>
        <div>
          {label('Terms & conditions')}
          <textarea value={form.terms} onChange={e=>set('terms',e.target.value)} rows={3}
            style={{ ...inp, resize:'vertical' }} placeholder="e.g. Payment within 30 days..." />
        </div>
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8, paddingTop:14, borderTop:'1px solid #f3f4f6' }}>
        <button onClick={onCancel} disabled={saving}
          style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'8px 20px', fontSize:13, cursor:'pointer', background:'white', color:'#374151' }}>
          Cancel
        </button>
        <button onClick={()=>onSave(form)} disabled={saving || !form.issuing_company || !form.client_name || !form.items.some(i=>i.description)}
          style={{ border:'none', borderRadius:8, padding:'8px 20px', fontSize:13, cursor:'pointer', background:'#1a3a2a', color:'white', fontWeight:600, opacity: saving?0.6:1 }}>
          {saving ? 'Saving…' : 'Save Document'}
        </button>
      </div>
    </div>
  )
}

// ─── main board ───────────────────────────────────────────────────────────────
interface Props {
  initialInvoices: Invoice[]
  currentUser: SessionUser
}

const STATUS_FLOW: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft:     ['sent', 'cancelled'],
  sent:      ['accepted', 'paid', 'overdue', 'cancelled'],
  accepted:  ['paid', 'cancelled'],
  overdue:   ['paid', 'cancelled'],
  paid:      [],
  cancelled: [],
}

export default function InvoiceBoard({ initialInvoices, currentUser }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices)
  const [active,   setActive]   = useState<Invoice | null>(null)
  const [tab,      setTab]      = useState<'list' | 'create' | 'edit'>('list')
  const [detailTab, setDetailTab] = useState<'detail' | 'dn'>('detail')

  const [search,      setSearch]   = useState('')
  const [filterType,  setFType]    = useState<DocType | 'all'>('all')
  const [filterStatus,setFStatus]  = useState<InvoiceStatus | 'all'>('all')
  const [filterCo,    setFCo]      = useState<string>('all')

  const [saving,    setSaving]  = useState(false)
  const [showPrint, setShowPrint] = useState(false)
  const [dns,       setDns]     = useState<DeliveryNote[]>([])
  const [loadingDn, setLoadingDn] = useState(false)
  const [showDnForm, setShowDnForm] = useState(false)
  const [dnSaving,  setDnSaving]   = useState(false)
  const [dnForm,    setDnForm]     = useState<Partial<DeliveryNote>>({})

  const filtered = useMemo(() => invoices.filter(inv => {
    if (filterType   !== 'all' && inv.type   !== filterType)   return false
    if (filterStatus !== 'all' && inv.status !== filterStatus) return false
    if (filterCo     !== 'all' && inv.issuing_company !== filterCo) return false
    const q = search.toLowerCase()
    return !q || inv.doc_no.toLowerCase().includes(q) || inv.client_name.toLowerCase().includes(q) || inv.issuing_company.toLowerCase().includes(q)
  }), [invoices, filterType, filterStatus, filterCo, search])

  const loadDns = useCallback(async (inv: Invoice) => {
    setLoadingDn(true)
    try {
      const res = await fetch(`/api/finance/delivery-notes?invoice_id=${inv.id}`, { credentials:'include' })
      if (res.ok) setDns(await res.json())
    } finally { setLoadingDn(false) }
  }, [])

  function openInvoice(inv: Invoice) {
    setActive(inv)
    setDetailTab('detail')
    setShowPrint(false)
    setShowDnForm(false)
    setDns([])
  }

  useEffect(() => {
    if (active && detailTab === 'dn') loadDns(active)
  }, [active, detailTab, loadDns])

  async function saveInvoice(form: ReturnType<typeof blankForm>) {
    setSaving(true)
    try {
      const isEdit = tab === 'edit' && active
      const url    = isEdit ? `/api/finance/invoices/${active.id}` : '/api/finance/invoices'
      const method = isEdit ? 'PATCH' : 'POST'
      const res  = await fetch(url, { method, headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(form) })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Save failed'); return }
      if (isEdit) {
        setInvoices(v => v.map(i => i.id === data.id ? data : i))
        setActive(data)
        setTab('list')
      } else {
        setInvoices(v => [data, ...v])
        setActive(data)
        setTab('list')
      }
    } finally { setSaving(false) }
  }

  async function updateStatus(inv: Invoice, status: InvoiceStatus) {
    const res  = await fetch(`/api/finance/invoices/${inv.id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ status }) })
    const data = await res.json()
    if (res.ok) {
      setInvoices(v => v.map(i => i.id === data.id ? data : i))
      if (active?.id === data.id) setActive(data)
    }
  }

  async function deleteInvoice(inv: Invoice) {
    if (!confirm(`Delete ${inv.doc_no}?`)) return
    const res = await fetch(`/api/finance/invoices/${inv.id}`, { method:'DELETE', credentials:'include' })
    if (res.ok) { setInvoices(v => v.filter(i => i.id !== inv.id)); if (active?.id === inv.id) setActive(null) }
  }

  async function convertQuote(inv: Invoice) {
    if (!confirm(`Convert ${inv.doc_no} to an Invoice?`)) return
    const res  = await fetch(`/api/finance/invoices/${inv.id}/convert`, { method:'POST', credentials:'include' })
    const data = await res.json()
    if (res.ok) {
      setInvoices(v => [data, ...v.map(i => i.id === inv.id ? { ...i, status:'accepted' as InvoiceStatus } : i)])
      setActive(data)
    } else alert(data.error || 'Convert failed')
  }

  async function saveDn() {
    if (!active) return
    setDnSaving(true)
    try {
      const payload = {
        ...dnForm,
        invoice_id: active.id,
        invoice_no: active.doc_no,
        items: dnForm.items?.length ? dnForm.items : active.items,
        delivery_date: dnForm.delivery_date || new Date().toISOString().slice(0,10),
      }
      const res  = await fetch('/api/finance/delivery-notes', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(payload) })
      const data = await res.json()
      if (res.ok) { setDns(v => [data, ...v]); setShowDnForm(false); setDnForm({}) }
      else alert(data.error || 'Failed')
    } finally { setDnSaving(false) }
  }

  // ─── sidebar list ──────────────────────────────────────────────────────────
  const sidebar = (
    <div style={{ width:300, minWidth:260, borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', background:'#fafafa', flexShrink:0 }}>
      <div style={{ padding:'14px 14px 8px' }}>
        <div style={{ display:'flex', gap:8, marginBottom:10 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
            style={{ flex:1, border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 10px', fontSize:12, background:'white' }} />
          <button onClick={()=>{ setActive(null); setTab('create') }}
            style={{ border:'none', borderRadius:6, padding:'6px 12px', background:'#1a3a2a', color:'white', fontSize:12, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>
            + New
          </button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <select value={filterType} onChange={e=>setFType(e.target.value as DocType|'all')}
            style={{ border:'1px solid #e5e7eb', borderRadius:5, padding:'4px 6px', fontSize:11, background:'white' }}>
            <option value="all">All types</option>
            <option value="invoice">Invoice</option>
            <option value="quotation">Quotation</option>
            <option value="lpo">LPO</option>
          </select>
          <select value={filterStatus} onChange={e=>setFStatus(e.target.value as InvoiceStatus|'all')}
            style={{ border:'1px solid #e5e7eb', borderRadius:5, padding:'4px 6px', fontSize:11, background:'white' }}>
            <option value="all">All statuses</option>
            {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map(s=>(
              <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <select value={filterCo} onChange={e=>setFCo(e.target.value)}
          style={{ marginTop:6, border:'1px solid #e5e7eb', borderRadius:5, padding:'4px 6px', fontSize:11, width:'100%', background:'white' }}>
          <option value="all">All companies</option>
          {COMPANIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ fontSize:11, color:'#9ca3af', padding:'0 14px 6px' }}>{filtered.length} document{filtered.length!==1?'s':''}</div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {filtered.map(inv => (
          <div key={inv.id} onClick={()=>{ openInvoice(inv); setTab('list') }}
            style={{ padding:'10px 14px', borderBottom:'1px solid #f0f0f0', cursor:'pointer',
              background: active?.id===inv.id ? '#e6efe8' : 'white',
              borderLeft: active?.id===inv.id ? '3px solid #1a3a2a' : '3px solid transparent' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
              <span style={{ fontSize:12, fontWeight:700, color:'#1a3a2a' }}>{inv.doc_no}</span>
              <StatusBadge status={inv.status} />
            </div>
            <div style={{ fontSize:12, color:'#374151', fontWeight:500, marginBottom:2 }}>{inv.client_name}</div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'#9ca3af' }}>
              <span>{inv.issuing_company}</span>
              <span style={{ fontWeight:600, color:'#1a3a2a' }}>{fmt(inv.total)}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:3 }}>
              <DocBadge type={inv.type} />
              <span style={{ fontSize:10, color:'#d1d5db' }}>{fmtD(inv.issue_date)}</span>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:40, color:'#9ca3af', fontSize:13 }}>
            No documents found
          </div>
        )}
      </div>
    </div>
  )

  // ─── detail panel ──────────────────────────────────────────────────────────
  const detail = active && tab === 'list' && (
    <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* Header bar */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
            <span style={{ fontWeight:700, fontSize:16, color:'#1a3a2a' }}>{active.doc_no}</span>
            <DocBadge type={active.type} />
            <StatusBadge status={active.status} />
          </div>
          <div style={{ fontSize:12, color:'#6b7280', marginTop:2 }}>{active.issuing_company} → {active.client_name}</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {active.type === 'quotation' && active.status !== 'cancelled' && (
            <button onClick={()=>convertQuote(active)}
              style={{ border:'1px solid #6d28d9', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', background:'#ede9fe', color:'#6d28d9', fontWeight:600 }}>
              → Convert to Invoice
            </button>
          )}
          <button onClick={()=>setShowPrint(true)}
            style={{ border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', background:'white' }}>
            🖨 Print
          </button>
          <button onClick={()=>setTab('edit')}
            style={{ border:'1px solid #1a3a2a', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', background:'white', color:'#1a3a2a', fontWeight:600 }}>
            Edit
          </button>
          <button onClick={()=>deleteInvoice(active)}
            style={{ border:'1px solid #fca5a5', borderRadius:6, padding:'6px 12px', fontSize:12, cursor:'pointer', background:'#fff5f5', color:'#dc2626' }}>
            Delete
          </button>
        </div>
      </div>

      {/* Status actions */}
      {STATUS_FLOW[active.status].length > 0 && (
        <div style={{ padding:'8px 20px', background:'#f9fafb', borderBottom:'1px solid #e5e7eb', display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'#6b7280', fontWeight:600 }}>Move to:</span>
          {STATUS_FLOW[active.status].map(s => (
            <button key={s} onClick={()=>updateStatus(active, s)}
              style={{ border:`1px solid ${INVOICE_STATUS_STYLE[s].color}`, borderRadius:12, padding:'3px 12px', fontSize:11, cursor:'pointer',
                background:INVOICE_STATUS_STYLE[s].bg, color:INVOICE_STATUS_STYLE[s].color, fontWeight:600 }}>
              {INVOICE_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid #e5e7eb', padding:'0 20px' }}>
        {(['detail','dn'] as const).map(t => (
          <button key={t} onClick={()=>setDetailTab(t)}
            style={{ border:'none', borderBottom: detailTab===t ? '2px solid #1a3a2a' : '2px solid transparent', background:'transparent', padding:'9px 14px', cursor:'pointer', fontSize:12, fontWeight: detailTab===t?700:400, color: detailTab===t?'#1a3a2a':'#6b7280' }}>
            {t === 'detail' ? '📄 Document' : '📦 Delivery Notes'}
          </button>
        ))}
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:20 }}>
        {detailTab === 'detail' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
              <div style={{ background:'#f9fafb', borderRadius:8, padding:'12px 16px' }}>
                <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Issue Date</div>
                <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{fmtD(active.issue_date)}</div>
              </div>
              {active.due_date && (
                <div style={{ background:'#f9fafb', borderRadius:8, padding:'12px 16px' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Due Date</div>
                  <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{fmtD(active.due_date)}</div>
                </div>
              )}
              {active.validity_date && (
                <div style={{ background:'#f9fafb', borderRadius:8, padding:'12px 16px' }}>
                  <div style={{ fontSize:10, color:'#9ca3af', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Valid Until</div>
                  <div style={{ fontSize:14, fontWeight:700, marginTop:2 }}>{fmtD(active.validity_date)}</div>
                </div>
              )}
              <div style={{ background:'#1a3a2a', borderRadius:8, padding:'12px 16px' }}>
                <div style={{ fontSize:10, color:'rgba(255,255,255,0.6)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Total</div>
                <div style={{ fontSize:16, fontWeight:700, color:'white', marginTop:2 }}>{fmt(active.total)}</div>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Bill To</div>
              <div style={{ background:'#f9fafb', borderRadius:8, padding:'12px 16px' }}>
                <div style={{ fontWeight:700 }}>{active.client_name}</div>
                {active.client_address && <div style={{ fontSize:12, color:'#6b7280', marginTop:2, whiteSpace:'pre-line' }}>{active.client_address}</div>}
                {active.client_email   && <div style={{ fontSize:12, color:'#6b7280' }}>{active.client_email}</div>}
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:8, textTransform:'uppercase', letterSpacing:'0.05em' }}>Line Items</div>
              <ItemsEditor items={active.items} onChange={()=>{}} readonly />
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }}>
              <div style={{ minWidth:220, border:'1px solid #e5e7eb', borderRadius:8, overflow:'hidden', fontSize:13 }}>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 14px', background:'#f9fafb' }}>
                  <span style={{ color:'#6b7280' }}>Subtotal</span><span style={{ fontWeight:600 }}>{fmt(active.subtotal)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'6px 14px', background:'#f9fafb', borderTop:'1px solid #e5e7eb' }}>
                  <span style={{ color:'#6b7280' }}>VAT ({active.tax_rate}%)</span><span style={{ fontWeight:600 }}>{fmt(active.tax_amount)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 14px', background:'#1a3a2a', color:'white' }}>
                  <span style={{ fontWeight:700 }}>Total</span><span style={{ fontWeight:700 }}>{fmt(active.total)}</span>
                </div>
              </div>
            </div>

            {(active.notes || active.terms) && (
              <div style={{ display:'grid', gridTemplateColumns: active.notes&&active.terms?'1fr 1fr':'1fr', gap:12, marginBottom:8 }}>
                {active.notes && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Notes</div>
                    <div style={{ fontSize:12, color:'#4b5563', whiteSpace:'pre-line' }}>{active.notes}</div>
                  </div>
                )}
                {active.terms && (
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'#6b7280', marginBottom:4, textTransform:'uppercase', letterSpacing:'0.05em' }}>Terms & Conditions</div>
                    <div style={{ fontSize:12, color:'#4b5563', whiteSpace:'pre-line' }}>{active.terms}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {detailTab === 'dn' && (
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:13, fontWeight:600 }}>Delivery Notes for {active.doc_no}</div>
              <button onClick={()=>{ setShowDnForm(true); setDnForm({ items: active.items, delivered_to: active.client_name }) }}
                style={{ border:'none', borderRadius:6, padding:'6px 14px', background:'#1a3a2a', color:'white', fontSize:12, cursor:'pointer', fontWeight:600 }}>
                + New DN
              </button>
            </div>
            {showDnForm && (
              <div style={{ background:'#f9fafb', borderRadius:8, padding:16, marginBottom:16, border:'1px solid #e5e7eb' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Delivered To *</label>
                    <input value={dnForm.delivered_to||''} onChange={e=>setDnForm(f=>({...f,delivered_to:e.target.value}))}
                      style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 10px', fontSize:12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Received By</label>
                    <input value={dnForm.received_by||''} onChange={e=>setDnForm(f=>({...f,received_by:e.target.value}))}
                      style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 10px', fontSize:12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Delivery Date</label>
                    <input type="date" value={dnForm.delivery_date||new Date().toISOString().slice(0,10)} onChange={e=>setDnForm(f=>({...f,delivery_date:e.target.value}))}
                      style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 10px', fontSize:12 }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, fontWeight:600, color:'#6b7280', display:'block', marginBottom:3 }}>Notes</label>
                    <input value={dnForm.notes||''} onChange={e=>setDnForm(f=>({...f,notes:e.target.value}))}
                      style={{ width:'100%', border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 10px', fontSize:12 }} />
                  </div>
                </div>
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button onClick={()=>{setShowDnForm(false);setDnForm({})}} style={{ border:'1px solid #e5e7eb', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer', background:'white' }}>Cancel</button>
                  <button onClick={saveDn} disabled={dnSaving||!dnForm.delivered_to}
                    style={{ border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, cursor:'pointer', background:'#1a3a2a', color:'white', fontWeight:600, opacity:dnSaving?0.6:1 }}>
                    {dnSaving?'Saving…':'Create DN'}
                  </button>
                </div>
              </div>
            )}
            {loadingDn && <div style={{ textAlign:'center', padding:20, color:'#9ca3af', fontSize:13 }}>Loading…</div>}
            {!loadingDn && dns.length === 0 && !showDnForm && (
              <div style={{ textAlign:'center', padding:40, color:'#9ca3af', fontSize:13 }}>No delivery notes yet</div>
            )}
            {dns.map(dn => (
              <div key={dn.id} style={{ border:'1px solid #e5e7eb', borderRadius:8, padding:'12px 16px', marginBottom:8, background:'white' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{dn.dn_no}</span>
                  <span style={{ fontSize:11, color:'#9ca3af' }}>{fmtD(dn.delivery_date)}</span>
                </div>
                <div style={{ fontSize:12, color:'#4b5563' }}>To: <strong>{dn.delivered_to}</strong>{dn.received_by ? ` · Received by: ${dn.received_by}` : ''}</div>
                {dn.notes && <div style={{ fontSize:12, color:'#6b7280', marginTop:3 }}>{dn.notes}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  const emptyState = !active && tab === 'list' && (
    <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12, color:'#9ca3af' }}>
      <div style={{ fontSize:40 }}>📋</div>
      <div style={{ fontSize:14, fontWeight:600 }}>Select a document</div>
      <div style={{ fontSize:12 }}>or click <strong>+ New</strong> to create one</div>
    </div>
  )

  return (
    <div style={{ display:'flex', height:'calc(100vh - 56px)', overflow:'hidden', background:'white' }}>
      {sidebar}

      {/* Main area */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {(tab === 'create' || tab === 'edit') && (
          <div style={{ flex:1, overflowY:'auto' }}>
            <div style={{ padding:'14px 20px', borderBottom:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:10 }}>
              <button onClick={()=>setTab('list')} style={{ border:'1px solid #e5e7eb', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', background:'white' }}>← Back</button>
              <span style={{ fontWeight:700, fontSize:15 }}>{tab === 'edit' ? `Edit ${active?.doc_no}` : 'New Document'}</span>
            </div>
            <InvoiceForm
              initial={tab === 'edit' && active ? { ...blankForm(active.type), ...active } : blankForm()}
              onSave={saveInvoice}
              onCancel={()=>setTab('list')}
              saving={saving}
            />
          </div>
        )}
        {detail}
        {emptyState}
      </div>

      {showPrint && active && <PrintPreview inv={active} onClose={()=>setShowPrint(false)} />}
    </div>
  )
}
