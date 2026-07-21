'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'

interface AnyItem { qty?: string; description: string; item_code?: string; unit?: string }
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
  issuing_company: string
  created_by: string
  created_at: string
}

function fmtDate(d: string) {
  if (!d) return ''
  const parts = d.slice(0, 10).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d
}

export default function DeliveryNoteView({ id, currentUser }: { id: string; currentUser: SessionUser }) {
  const [note, setNote] = useState<DeliveryNote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/delivery-notes/${id}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setNote(d))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div style={{ padding:60, textAlign:'center', fontFamily:'system-ui', color:'#9ca3af' }}>Loading…</div>
  if (!note || (note as unknown as { error: string }).error) return <div style={{ padding:60, textAlign:'center', fontFamily:'system-ui', color:'#dc2626' }}>Delivery note not found.</div>

  const items: AnyItem[] = Array.isArray(note.items) ? note.items : JSON.parse(note.items as unknown as string ?? '[]')
  const co = note.issuing_company || 'mercury'

  return (
    <>
      <div className="no-print" style={{ background:'#1a3a2a', padding:'10px 24px', display:'flex', alignItems:'center', gap:14, fontFamily:'system-ui' }}>
        <a href="/delivery-notes" style={{ color:'rgba(255,255,255,0.7)', textDecoration:'none', fontSize:13 }}>← Back to Delivery Notes</a>
        <div style={{ flex:1 }} />
        {note.status==='cancelled' && (
          <span style={{ fontSize:12, fontWeight:700, color:'#fca5a5', background:'rgba(220,38,38,0.2)', border:'1px solid rgba(220,38,38,0.4)', borderRadius:6, padding:'4px 12px' }}>
            CANCELLED{note.cancel_reason?` · ${note.cancel_reason}`:''}
          </span>
        )}
        <span style={{ fontSize:12, color:'rgba(255,255,255,0.6)' }}>DN-{note.note_number} · {note.to_company}</span>
        <button onClick={()=>window.print()}
          style={{ background:'#b5833a', color:'white', border:'none', borderRadius:8, padding:'9px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>
          🖨 Print / Save PDF
        </button>
      </div>

      <div style={{ background:'#e5e7eb', minHeight:'calc(100vh - 46px)', padding:'32px 24px', fontFamily:'system-ui' }} className="no-print-bg">
        <div style={{ maxWidth:720, margin:'0 auto', background:'white', boxShadow:'0 4px 20px rgba(0,0,0,0.15)', position:'relative', overflow:'hidden' }}>
          {note.status==='cancelled' && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none', zIndex:10 }}>
              <div style={{ transform:'rotate(-30deg)', fontSize:72, fontWeight:900, color:'rgba(220,38,38,0.12)', letterSpacing:'0.05em', userSelect:'none', whiteSpace:'nowrap' }}>CANCELLED</div>
            </div>
          )}
          {co==='bytewise'
            ? <BytewiseTemplate note={note} items={items} />
            : <MercuryTemplate  note={note} items={items} />
          }
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          body { margin: 0; }
          @page { margin: 10mm 12mm; size: A4; }
        }
        @media screen { .print-only { display: none !important; } }
      `}</style>
    </>
  )
}

// ── MERCURY TEMPLATE ──────────────────────────────────────────────────────────
function MercuryTemplate({ note, items }: { note: DeliveryNote; items: AnyItem[] }) {
  const rows = [...items] as MercuryItem[]
  while (rows.length < 8) rows.push({ qty:'', description:'' })

  return (
    <div style={{ padding:'28px 32px 36px', fontFamily:'"Times New Roman",Times,serif', fontSize:12, color:'#000', lineHeight:1.4 }}>
      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:14 }}>
        <div style={{ marginBottom:8, display:'flex', justifyContent:'center' }}>
          <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="4" fill="#3D2314"/>
            <polygon points="4,54 18,12 27,36" fill="white"/>
            <polygon points="60,54 46,12 37,36" fill="white"/>
            <polygon points="27,36 32,18 37,36 32,48" fill="white"/>
            <polygon points="32,44 28,52 32,56 36,52" fill="#C9A84C"/>
          </svg>
        </div>
        <div style={{ fontWeight:900, fontSize:16, letterSpacing:'0.1em', textTransform:'uppercase' }}>MERCURY AGENCIES LIMITED</div>
        <div style={{ fontSize:11, marginTop:3 }}>P.O BOX 11250 - 00400</div>
        <div style={{ fontSize:11 }}>NAIROBI.</div>
        <div style={{ fontSize:11 }}>TEL: 0722 456 548</div>
      </div>
      <div style={{ border:'1px solid #000', borderBottom:'none', padding:'5px 0', textAlign:'center' }}>
        <span style={{ fontWeight:900, fontSize:13, letterSpacing:'0.12em', textTransform:'uppercase' }}>DELIVERY NOTE</span>
      </div>
      <div style={{ border:'1px solid #000', borderBottom:'none', display:'flex', justifyContent:'flex-end', padding:'5px 12px', gap:6 }}>
        <span style={{ fontWeight:700 }}>NO:</span>
        <span style={{ minWidth:60, borderBottom:'1px solid #000', paddingLeft:4 }}>{note.note_number}</span>
      </div>
      <div style={{ border:'1px solid #000', borderBottom:'none', padding:'7px 12px', display:'flex', alignItems:'flex-end', gap:8 }}>
        <span style={{ fontWeight:700, whiteSpace:'nowrap' }}>M/S</span>
        <span style={{ flex:1, borderBottom:'1px solid #000', paddingBottom:1, paddingLeft:4, minHeight:18 }}>{note.to_company}</span>
      </div>
      <div style={{ border:'1px solid #000', borderBottom:'none', padding:'7px 12px', display:'flex', justifyContent:'flex-end' }}>
        <div style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
          <span style={{ fontWeight:700 }}>Date</span>
          <span style={{ borderBottom:'1px solid #000', minWidth:80, textAlign:'center', minHeight:18, paddingLeft:4 }}>{fmtDate(note.delivery_date)}</span>
        </div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', border:'1px solid #000' }}>
        <thead><tr>
          <th style={{ border:'1px solid #000', padding:'6px 10px', fontWeight:900, textAlign:'center', width:100 }}>Quantity</th>
          <th style={{ border:'1px solid #000', padding:'6px 10px', fontWeight:900, textAlign:'center' }}>Goods Description</th>
        </tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{ border:'1px solid #000', padding:'6px 10px', textAlign:'center', height:28, verticalAlign:'top' }}>{row.qty??''}</td>
              <td style={{ border:'1px solid #000', padding:'6px 10px', verticalAlign:'top', height:28 }}>
                {row.description}
                {i===0&&(note.vehicle_no||note.driver_name||note.driver_id)&&(
                  <div style={{ marginTop:2, fontSize:10, color:'#555' }}>
                    {note.vehicle_no  &&<div>Vehicle No: {note.vehicle_no}</div>}
                    {note.driver_name &&<div>Driver: {note.driver_name}</div>}
                    {note.driver_id   &&<div>ID: {note.driver_id}</div>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2} style={{ border:'1px solid #000', padding:'5px 10px', fontStyle:'italic', fontSize:11, fontWeight:700 }}>E.&amp;O.E</td></tr></tfoot>
      </table>
      <div style={{ border:'1px solid #000', borderTop:'none', padding:'5px 12px', fontSize:11 }}>
        <span style={{ fontWeight:700 }}>NO: B</span>
        {note.remarks&&<span style={{ marginLeft:16, fontStyle:'italic' }}>{note.remarks}</span>}
      </div>
      <div style={{ border:'1px solid #000', borderTop:'none', padding:'7px 12px', fontSize:11, fontStyle:'italic' }}>Please receive the undermentioned goods in good order and condition</div>
      <div style={{ border:'1px solid #000', borderTop:'none', padding:'18px 12px 24px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:32 }}>
        <div><div style={{ borderBottom:'1px solid #000', paddingBottom:18, marginBottom:4 }}/><div style={{ fontSize:11, fontWeight:700 }}>Signature</div></div>
        <div><div style={{ borderBottom:'1px solid #000', paddingBottom:18, marginBottom:4 }}/><div style={{ fontSize:11, fontWeight:700 }}>Company Rubber Stamp</div></div>
      </div>
      <div style={{ textAlign:'right', marginTop:8, fontSize:10, color:'#555' }} className="no-print">Generated by Pabari ERP · {new Date().toLocaleDateString('en-GB')}</div>
    </div>
  )
}

// ── BYTEWISE TEMPLATE ─────────────────────────────────────────────────────────
function BytewiseTemplate({ note, items }: { note: DeliveryNote; items: AnyItem[] }) {
  const rows = [...items] as BytewiseItem[]
  while (rows.length < 8) rows.push({ item_code:'', description:'', unit:'' })

  return (
    <div style={{ padding:'28px 32px 36px', fontFamily:'Arial,Helvetica,sans-serif', fontSize:12, color:'#000', lineHeight:1.4 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          {/* ByteWISE logo */}
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
            <svg width="36" height="36" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="6" fill="#1a5c3a"/>
              <ellipse cx="32" cy="20" rx="10" ry="14" fill="#4ade80" opacity="0.9"/>
              <ellipse cx="22" cy="30" rx="8" ry="12" fill="#86efac" opacity="0.7"/>
              <path d="M20 44 Q32 52 44 44" stroke="white" strokeWidth="2.5" fill="none"/>
              <text x="32" y="56" textAnchor="middle" fontSize="8" fontWeight="900" fill="white">ByteWISE</text>
            </svg>
            <div>
              <span style={{ fontWeight:900, fontSize:18, color:'#1a5c3a' }}>Byte</span><span style={{ fontWeight:900, fontSize:18, color:'#111' }}>WISE</span>
            </div>
          </div>
          <div style={{ fontWeight:700, fontSize:11, color:'#111' }}>BYTEWISE LIMITED</div>
          <div style={{ fontSize:10, color:'#444' }}>P.O. BOX: 63416-00619 NAIROBI KENYA</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontWeight:900, fontSize:15, letterSpacing:'0.1em', textTransform:'uppercase', border:'2px solid #000', padding:'4px 14px', marginBottom:8 }}>DELIVERY NOTE</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end', marginBottom:4 }}>
            <span style={{ fontWeight:700, fontSize:11 }}>Delivery Note No</span>
            <span style={{ fontWeight:900, fontSize:14, color:'#dc2626', border:'1px solid #dc2626', padding:'1px 8px', borderRadius:3, minWidth:60, textAlign:'center' }}>{note.note_number}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'flex-end' }}>
            <span style={{ fontWeight:700, fontSize:11 }}>Date</span>
            <span style={{ borderBottom:'1px solid #000', minWidth:90, paddingLeft:4, fontSize:12 }}>{fmtDate(note.delivery_date)}</span>
          </div>
        </div>
      </div>

      {/* Customer Details box */}
      <div style={{ border:'2px solid #000', padding:'10px 14px', marginBottom:14, minHeight:60 }}>
        <div style={{ fontWeight:700, fontSize:11, textTransform:'uppercase', marginBottom:6, letterSpacing:'0.05em' }}>Customer Details</div>
        <div style={{ fontSize:13, fontWeight:600 }}>{note.to_company}</div>
      </div>

      {/* Goods table */}
      <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:14 }}>
        <thead><tr style={{ background:'#f3f4f6' }}>
          <th style={{ border:'1px solid #000', padding:'7px 10px', fontWeight:700, textAlign:'center', width:36, fontSize:11 }}>S.No</th>
          <th style={{ border:'1px solid #000', padding:'7px 10px', fontWeight:700, textAlign:'center', width:110, fontSize:11 }}>Item Code</th>
          <th style={{ border:'1px solid #000', padding:'7px 10px', fontWeight:700, textAlign:'center', fontSize:11 }}>Description</th>
          <th style={{ border:'1px solid #000', padding:'7px 10px', fontWeight:700, textAlign:'center', width:70, fontSize:11 }}>Unit</th>
        </tr></thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td style={{ border:'1px solid #000', padding:'6px 10px', textAlign:'center', height:26, color:'#666' }}>{i+1}</td>
              <td style={{ border:'1px solid #000', padding:'6px 10px', textAlign:'center', height:26 }}>{row.item_code??''}</td>
              <td style={{ border:'1px solid #000', padding:'6px 10px', height:26 }}>{row.description}</td>
              <td style={{ border:'1px solid #000', padding:'6px 10px', textAlign:'center', height:26 }}>{row.unit??''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Driver Details */}
      <div style={{ border:'1px solid #000', padding:'10px 14px', marginBottom:20 }}>
        <div style={{ fontWeight:700, fontSize:11, textTransform:'uppercase', marginBottom:8, letterSpacing:'0.05em' }}>Driver Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 24px' }}>
          {[
            ['Vehicle No:',      note.vehicle_no],
            ['Gate Pass Number:',note.gate_pass_number],
            ['Driver Name:',     note.driver_name],
            ['Driver I/D No:',   note.driver_id],
          ].map(([label, val]) => (
            <div key={label} style={{ display:'flex', alignItems:'flex-end', gap:8 }}>
              <span style={{ fontWeight:700, fontSize:11, whiteSpace:'nowrap' }}>{label}</span>
              <span style={{ flex:1, borderBottom:'1px solid #000', minHeight:16, paddingLeft:4, fontSize:12 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Signature block */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:24 }}>
        {['Receiver Name:', 'Signature:', 'Official Stamp:'].map(label => (
          <div key={label}>
            <div style={{ fontSize:11, fontWeight:700, marginBottom:4 }}>{label}</div>
            <div style={{ borderBottom:'1px dotted #000', paddingBottom:20 }}/>
          </div>
        ))}
      </div>

      <div style={{ textAlign:'right', marginTop:12, fontSize:10, color:'#555' }} className="no-print">Generated by Pabari ERP · {new Date().toLocaleDateString('en-GB')}</div>
    </div>
  )
}
