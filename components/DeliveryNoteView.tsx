'use client'

import { useState, useEffect } from 'react'
import { SessionUser } from '@/types'

interface DeliveryNoteItem { qty: string; description: string }
interface DeliveryNote {
  id: number
  note_number: string
  to_company: string
  order_no: string
  delivery_date: string
  vehicle_no: string
  driver_name: string
  driver_id: string
  items: DeliveryNoteItem[]
  remarks: string
  created_by: string
  created_at: string
}

function fmtDate(d: string) {
  if (!d) return ''
  const clean = d.slice(0, 10) // strip time component from ISO timestamps
  const parts = clean.split('-')
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

  if (loading) return <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui', color: '#9ca3af' }}>Loading…</div>
  if (!note || (note as unknown as { error: string }).error) return <div style={{ padding: 60, textAlign: 'center', fontFamily: 'system-ui', color: '#dc2626' }}>Delivery note not found.</div>

  const items: DeliveryNoteItem[] = Array.isArray(note.items) ? note.items : JSON.parse(note.items as unknown as string ?? '[]')

  // Pad to at least 8 rows for the printed table
  const tableRows = [...items]
  while (tableRows.length < 8) tableRows.push({ qty: '', description: '' })

  return (
    <>
      {/* ── SCREEN TOOLBAR (hidden on print) ── */}
      <div className="no-print" style={{ background: '#1a3a2a', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 14, fontFamily: 'system-ui' }}>
        <a href="/delivery-notes" style={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontSize: 13 }}>← Back to Delivery Notes</a>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>DN-{note.note_number} · {note.to_company}</span>
        <button onClick={() => window.print()}
          style={{ background: '#b5833a', color: 'white', border: 'none', borderRadius: 8, padding: '9px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
          🖨 Print / Save PDF
        </button>
      </div>

      {/* ── PRINT PREVIEW WRAPPER ── */}
      <div style={{ background: '#e5e7eb', minHeight: 'calc(100vh - 46px)', padding: '32px 24px', fontFamily: 'system-ui' }} className="no-print-bg">
        <div style={{ maxWidth: 700, margin: '0 auto', background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
          <DeliveryNoteDocument note={note} items={items} tableRows={tableRows} />
        </div>
      </div>

      {/* ── PRINT STYLES ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .no-print-bg { background: white !important; padding: 0 !important; }
          body { margin: 0; }
          @page { margin: 12mm 14mm; size: A4; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>
    </>
  )
}

function DeliveryNoteDocument({ note, items, tableRows }: {
  note: DeliveryNote
  items: DeliveryNoteItem[]
  tableRows: DeliveryNoteItem[]
}) {
  return (
    <div style={{ padding: '28px 32px 36px', fontFamily: '"Times New Roman", Times, serif', fontSize: 12, color: '#000', lineHeight: 1.4 }}>

      {/* ── COMPANY HEADER ── */}
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        {/* Mercury Agencies (K) Ltd logo — dark brown square, white M peaks, gold accent */}
        <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
          <svg width="64" height="64" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <rect width="64" height="64" rx="4" fill="#3D2314"/>
            {/* Left peak */}
            <polygon points="4,54 18,12 27,36" fill="white"/>
            {/* Right peak */}
            <polygon points="60,54 46,12 37,36" fill="white"/>
            {/* Centre peak */}
            <polygon points="27,36 32,18 37,36 32,48" fill="white"/>
            {/* Gold accent — small diamond at centre base */}
            <polygon points="32,44 28,52 32,56 36,52" fill="#C9A84C"/>
          </svg>
        </div>
        <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '0.1em', textTransform: 'uppercase' }}>MERCURY AGENCIES LIMITED</div>
        <div style={{ fontSize: 11, marginTop: 3 }}>P.O BOX 11250 - 00400</div>
        <div style={{ fontSize: 11 }}>NAIROBI.</div>
        <div style={{ fontSize: 11 }}>TEL: 0722 456 548</div>
      </div>

      {/* ── DELIVERY NOTE TITLE BAR ── */}
      <div style={{ border: '1px solid #000', borderBottom: 'none', padding: '5px 0', textAlign: 'center', marginBottom: 0 }}>
        <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase' }}>DELIVERY NOTE</span>
      </div>

      {/* ── NO + DATE ROW ── */}
      <div style={{ border: '1px solid #000', borderBottom: 'none', display: 'flex', justifyContent: 'flex-end', padding: '5px 12px', gap: 6 }}>
        <span style={{ fontWeight: 700 }}>NO:</span>
        <span style={{ minWidth: 60, borderBottom: '1px solid #000', paddingLeft: 4 }}>{note.note_number}</span>
      </div>

      {/* ── M/S ROW ── */}
      <div style={{ border: '1px solid #000', borderBottom: 'none', padding: '7px 12px', display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>M/S</span>
        <span style={{ flex: 1, borderBottom: '1px solid #000', paddingBottom: 1, paddingLeft: 4, minHeight: 18 }}>{note.to_company}</span>
      </div>

      {/* ── ORDER NO + DATE ── */}
      <div style={{ border: '1px solid #000', borderBottom: 'none', padding: '7px 12px', display: 'flex', gap: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flex: 1 }}>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>ORDER NO.</span>
          <span style={{ flex: 1, borderBottom: '1px solid #000', minHeight: 18, paddingLeft: 4 }}>{note.order_no}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
          <span style={{ fontWeight: 700 }}>Date</span>
          <span style={{ borderBottom: '1px solid #000', minWidth: 80, textAlign: 'center', minHeight: 18, paddingLeft: 4 }}>{fmtDate(note.delivery_date)}</span>
        </div>
      </div>

      {/* ── GOODS TABLE ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: 900, textAlign: 'center', width: 100, fontSize: 12 }}>Quantity</th>
            <th style={{ border: '1px solid #000', padding: '6px 10px', fontWeight: 900, textAlign: 'center', fontSize: 12 }}>Goods Description</th>
          </tr>
        </thead>
        <tbody>
          {tableRows.map((row, i) => {
            const isDriverRow = i === 0 && (note.vehicle_no || note.driver_name)
            return (
              <tr key={i}>
                <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', height: 28, verticalAlign: 'top' }}>
                  {row.qty}
                </td>
                <td style={{ border: '1px solid #000', padding: '6px 10px', verticalAlign: 'top', height: 28 }}>
                  {row.description}
                  {/* Append vehicle/driver info inline with first data row */}
                  {isDriverRow && i === 0 && (note.vehicle_no || note.driver_name || note.driver_id) && (
                    <div style={{ marginTop: 2 }}>
                      {note.vehicle_no   && <div>Vehicle No: {note.vehicle_no}</div>}
                      {note.driver_name  && <div>Driver: {note.driver_name}</div>}
                      {note.driver_id    && <div>ID: {note.driver_id}</div>}
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} style={{ border: '1px solid #000', padding: '5px 10px', fontStyle: 'italic', fontSize: 11, fontWeight: 700 }}>
              E.&amp;O.E
            </td>
          </tr>
        </tfoot>
      </table>

      {/* ── REMARKS / NO: B line ── */}
      <div style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 12px', fontSize: 11 }}>
        <span style={{ fontWeight: 700 }}>NO: B</span>
        {note.remarks && <span style={{ marginLeft: 16, fontStyle: 'italic' }}>{note.remarks}</span>}
      </div>

      {/* ── RECEIVE STATEMENT ── */}
      <div style={{ border: '1px solid #000', borderTop: 'none', padding: '7px 12px', fontSize: 11, fontStyle: 'italic' }}>
        Please receive the undermentioned goods in good order and condition
      </div>

      {/* ── SIGNATURE BLOCK ── */}
      <div style={{ border: '1px solid #000', borderTop: 'none', padding: '18px 12px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: 18, marginBottom: 4 }} />
          <div style={{ fontSize: 11, fontWeight: 700 }}>Signature</div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #000', paddingBottom: 18, marginBottom: 4 }} />
          <div style={{ fontSize: 11, fontWeight: 700 }}>Company Rubber Stamp</div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ textAlign: 'right', marginTop: 8, fontSize: 10, color: '#555' }} className="no-print">
        Generated by Pabari ERP · {new Date().toLocaleDateString('en-GB')}
      </div>
    </div>
  )
}
