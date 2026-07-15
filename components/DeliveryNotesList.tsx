'use client'

import { useState, useEffect, useCallback } from 'react'
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

const EMPTY_ITEM: DeliveryNoteItem = { qty: '', description: '' }
const TODAY = new Date().toISOString().slice(0, 10)

function emptyForm() {
  return {
    to_company: '',
    delivery_date: TODAY,
    vehicle_no: '',
    driver_name: '',
    driver_id: '',
    items: [{ ...EMPTY_ITEM }, { ...EMPTY_ITEM }, { ...EMPTY_ITEM }],
    remarks: '',
  }
}

export default function DeliveryNotesList({ currentUser }: { currentUser: SessionUser }) {
  const [notes,     setNotes]     = useState<DeliveryNote[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [deleting,  setDeleting]  = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // ensure table exists
      await fetch('/api/delivery-notes/migrate', { method: 'POST' })
      const r = await fetch('/api/delivery-notes', { credentials: 'include' })
      if (!r.ok) return
      const d = await r.json()
      setNotes(d.notes ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function setItem(i: number, field: keyof DeliveryNoteItem, val: string) {
    setForm(f => {
      const items = [...f.items]
      items[i] = { ...items[i], [field]: val }
      return { ...f, items }
    })
  }

  function addRow() {
    setForm(f => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }))
  }

  function removeRow(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  }

  function openEdit(n: DeliveryNote) {
    const items = Array.isArray(n.items) ? n.items : JSON.parse(n.items as unknown as string ?? '[]')
    setForm({
      to_company:    n.to_company,
      delivery_date: n.delivery_date?.slice(0, 10) || TODAY,
      vehicle_no:    n.vehicle_no  || '',
      driver_name:   n.driver_name || '',
      driver_id:     n.driver_id   || '',
      items:         items.length ? items : [{ ...EMPTY_ITEM }, { ...EMPTY_ITEM }, { ...EMPTY_ITEM }],
      remarks:       n.remarks     || '',
    })
    setEditingId(n.id)
    setError('')
    setShowForm(true)
  }

  async function save() {
    setError('')
    if (!form.to_company.trim())  { setError('M/S (To Company) is required'); return }
    if (!form.delivery_date)      { setError('Date is required'); return }
    const filledItems = form.items.filter(it => it.qty.trim() || it.description.trim())
    if (!filledItems.length)      { setError('At least one item is required'); return }

    setSaving(true)
    try {
      if (editingId) {
        // ── Edit existing ──
        const existing = notes.find(n => n.id === editingId)
        const r = await fetch(`/api/delivery-notes/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            note_number:   existing?.note_number ?? '',
            to_company:    form.to_company,
            order_no:      '',
            delivery_date: form.delivery_date,
            vehicle_no:    form.vehicle_no,
            driver_name:   form.driver_name,
            driver_id:     form.driver_id,
            items:         filledItems,
            remarks:       form.remarks,
          }),
        })
        const j = await r.json()
        if (!r.ok) { setError(j.error ?? `Save failed (${r.status})`); setSaving(false); return }
        setShowForm(false)
        setEditingId(null)
        setForm(emptyForm())
        await load()
      } else {
        // ── Create new ──
        await fetch('/api/delivery-notes/migrate', { method: 'POST' }).catch(() => {})
        const r = await fetch('/api/delivery-notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...form, items: filledItems }),
        })
        const j = await r.json()
        if (!r.ok) { setError(j.error ?? `Save failed (${r.status})`); setSaving(false); return }
        const id = j.id
        if (!id) { setError('No ID returned from server'); setSaving(false); return }
        window.location.href = `/delivery-notes/${id}`
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Network error — please try again')
      setSaving(false)
    }
  }

  async function deleteNote(id: number) {
    if (!confirm('Delete this delivery note?')) return
    setDeleting(id)
    await fetch(`/api/delivery-notes/${id}`, { method: 'DELETE', credentials: 'include' })
    setDeleting(null)
    await load()
  }

  const filtered = notes.filter(n =>
    !search ||
    n.note_number.toLowerCase().includes(search.toLowerCase()) ||
    n.to_company.toLowerCase().includes(search.toLowerCase()) ||
    n.driver_name?.toLowerCase().includes(search.toLowerCase())
  )

  const fmtDate = (d: string) => {
    if (!d) return ''
    const clean = d.slice(0, 10)
    const parts = clean.split('-')
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#1a3a2a', padding: '0 32px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <div style={{ background: '#b5833a', color: 'white', fontWeight: 800, fontSize: 11, padding: '5px 10px', borderRadius: 4, letterSpacing: '1px' }}>PABARI</div>
          </a>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Delivery Notes</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '3px 10px' }}>
            <svg width="14" height="14" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
              <rect width="64" height="64" rx="4" fill="#3D2314"/>
              <polygon points="4,54 18,12 27,36" fill="white"/>
              <polygon points="60,54 46,12 37,36" fill="white"/>
              <polygon points="27,36 32,18 37,36 32,48" fill="white"/>
              <polygon points="32,44 28,52 32,56 36,52" fill="#C9A84C"/>
            </svg>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>MERCURY AGENCIES LIMITED</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <a href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', textDecoration: 'none' }}>← Portal</a>
          <button onClick={() => { setEditingId(null); setForm(emptyForm()); setError(''); setShowForm(true) }}
            style={{ background: '#b5833a', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            + New Delivery Note
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px' }}>

        {/* Search */}
        <div style={{ marginBottom: 20 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by note no, company or driver…"
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', background: 'white', boxSizing: 'border-box' }}
          />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151' }}>{search ? 'No results' : 'No delivery notes yet'}</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Click "+ New Delivery Note" to create one.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(n => (
              <div key={n.id} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: '#f0fdf4', border: '1px solid #86efac', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#15803d' }}>DN</span>
                  <span style={{ fontSize: 10, color: '#15803d' }}>{n.note_number}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>M/S {n.to_company}</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                    {fmtDate(n.delivery_date)}
                    {n.vehicle_no && ` · ${n.vehicle_no}`}
                    {n.driver_name && ` · ${n.driver_name}`}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <a href={`/delivery-notes/${n.id}`}
                    style={{ background: '#1a3a2a', color: 'white', borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}>
                    View / Print
                  </a>
                  <button onClick={() => openEdit(n)}
                    style={{ background: 'transparent', border: '1px solid #d1d5db', color: '#374151', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Edit
                  </button>
                  <button onClick={() => deleteNote(n.id)} disabled={deleting === n.id}
                    style={{ background: 'transparent', border: '1px solid #fecaca', color: '#dc2626', borderRadius: 7, padding: '7px 12px', fontSize: 12, cursor: 'pointer' }}>
                    {deleting === n.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── NEW NOTE FORM MODAL ───────────────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'white', borderRadius: 14, width: '100%', maxWidth: 700, padding: 32, position: 'relative' }}>
            <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()) }}
              style={{ position: 'absolute', top: 16, right: 16, background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6b7280' }}>✕</button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <svg width="40" height="40" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
                <rect width="64" height="64" rx="6" fill="#3D2314"/>
                <polygon points="4,54 18,12 27,36" fill="white"/>
                <polygon points="60,54 46,12 37,36" fill="white"/>
                <polygon points="27,36 32,18 37,36 32,48" fill="white"/>
                <polygon points="32,44 28,52 32,56 36,52" fill="#C9A84C"/>
              </svg>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{editingId ? 'Edit Delivery Note' : 'New Delivery Note'}</div>
                <div style={{ fontSize: 11, color: '#3D2314', fontWeight: 700 }}>MERCURY AGENCIES LIMITED</div>
              </div>
            </div>

            {/* Row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Note No</div>
                <div style={{ padding: '9px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>Auto-generated on save</div>
              </div>
              <Field label="Date *" type="date" value={form.delivery_date} onChange={v => setForm(f => ({ ...f, delivery_date: v }))} />
            </div>

            {/* Row 2 */}
            <div style={{ marginBottom: 14 }}>
              <Field label="M/S (To Company) *" value={form.to_company} onChange={v => setForm(f => ({ ...f, to_company: v }))} placeholder="e.g. Salim Khan Trading Ltd" />
            </div>

            {/* Driver/Vehicle row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
              <Field label="Vehicle No" value={form.vehicle_no} onChange={v => setForm(f => ({ ...f, vehicle_no: v }))} placeholder="e.g. KDH M37" />
              <Field label="Driver Name" value={form.driver_name} onChange={v => setForm(f => ({ ...f, driver_name: v }))} placeholder="Full name" />
              <Field label="Driver ID" value={form.driver_id} onChange={v => setForm(f => ({ ...f, driver_id: v }))} placeholder="ID No" />
            </div>

            {/* Items table */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Goods Items</div>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 36px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Quantity</div>
                  <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' }}>Goods Description</div>
                  <div />
                </div>
                {form.items.map((item, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 36px', borderBottom: i < form.items.length - 1 ? '1px solid #f3f4f6' : undefined }}>
                    <input
                      value={item.qty}
                      onChange={e => setItem(i, 'qty', e.target.value)}
                      placeholder="Qty"
                      style={{ padding: '9px 12px', border: 'none', borderRight: '1px solid #f3f4f6', outline: 'none', fontSize: 13, background: 'transparent' }}
                    />
                    <input
                      value={item.description}
                      onChange={e => setItem(i, 'description', e.target.value)}
                      placeholder="e.g. 2589 Biryani Rice"
                      style={{ padding: '9px 12px', border: 'none', outline: 'none', fontSize: 13, background: 'transparent', width: '100%', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => removeRow(i)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#d1d5db', fontSize: 16, padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
              <button onClick={addRow}
                style={{ marginTop: 8, background: 'transparent', border: '1px dashed #d1d5db', borderRadius: 6, padding: '6px 14px', fontSize: 12, color: '#6b7280', cursor: 'pointer', width: '100%' }}>
                + Add row
              </button>
            </div>

            {/* Remarks */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Remarks</label>
              <textarea
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                rows={2}
                placeholder="Any additional notes (optional)"
                style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#dc2626', marginBottom: 12 }}>
                ⚠ {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm()) }}
                style={{ background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 20px', fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={save} disabled={saving}
                style={{ background: saving ? '#9ca3af' : '#1a3a2a', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontSize: 13, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save & Preview'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }}
      />
    </div>
  )
}
