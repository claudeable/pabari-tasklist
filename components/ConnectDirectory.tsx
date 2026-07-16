'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { SessionUser } from '@/types'

type Contact = {
  id: number
  full_name: string
  position: string | null
  phone: string | null
  email: string | null
  country: string | null
  address: string | null
  company_id: number | null
  company_name: string | null
  categories: string[] | null
  needs_review: boolean
  duplicate_group: string | null
}

type Category = { id: number; name: string }

// Filter tabs are loaded dynamically from the DB; this is just the fallback while loading
const DEFAULT_TABS = ['All']

const emptyForm = () => ({
  fullName: '', companyName: '', position: '', phone: '', email: '', country: '', address: '',
  categoryNames: [] as string[],
})

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  bg:      '#12151c',
  card:    '#1b202b',
  border:  '#2b3242',
  text:    '#e9e6de',
  muted:   '#8b93a3',
  dim:     '#5c6272',
  brass:   '#e6bd72',
  accent:  '#c4923f',
  input:   '#232a37',
  green:   '#1a3a2a',
  pabari:  '#b5833a',
}

export default function ConnectDirectory({ currentUser }: { currentUser: SessionUser }) {
  const [query,    setQuery]    = useState('')
  const [tab,      setTab]      = useState('All')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [callTarget, setCallTarget] = useState<Contact | null>(null)

  // Form state
  const [showForm,   setShowForm]   = useState(false)
  const [editId,     setEditId]     = useState<number | null>(null)
  const [form,       setForm]       = useState(emptyForm())
  const [saving,     setSaving]     = useState(false)
  const [formError,  setFormError]  = useState('')
  const [newCatInput, setNewCatInput] = useState('')

  // All categories (for suggestions + filter tabs)
  const [allCategories, setAllCategories] = useState<Category[]>([])

  // Tab scroll
  const tabsRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  function updateScrollState() {
    const el = tabsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }

  useEffect(() => {
    const el = tabsRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState)
    window.addEventListener('resize', updateScrollState)
    return () => { el.removeEventListener('scroll', updateScrollState); window.removeEventListener('resize', updateScrollState) }
  }, [allCategories])

  function scrollTabs(dir: 'left' | 'right') {
    tabsRef.current?.scrollBy({ left: dir === 'right' ? 200 : -200, behavior: 'smooth' })
  }

  const loadCategories = useCallback(() => {
    fetch('/api/connect/categories').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setAllCategories(data)
    }).catch(() => {})
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  const loadContacts = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (tab !== 'All') params.set('category', tab)
    fetch(`/api/connect/contacts?${params}`)
      .then(r => r.json())
      .then(data => setContacts(data.contacts || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query, tab])

  useEffect(() => {
    const t = setTimeout(loadContacts, 200)
    return () => clearTimeout(t)
  }, [loadContacts])

  function openAdd() {
    setEditId(null)
    setForm(emptyForm())
    setFormError('')
    setShowForm(true)
  }

  function openEdit(c: Contact, e: React.MouseEvent) {
    e.stopPropagation()
    setEditId(c.id)
    setForm({
      fullName:      c.full_name,
      companyName:   c.company_name ?? '',
      position:      c.position ?? '',
      phone:         c.phone ?? '',
      email:         c.email ?? '',
      country:       c.country ?? '',
      address:       c.address ?? '',
      categoryNames: c.categories ?? [],
    })
    setFormError('')
    setShowForm(true)
  }

  function addCategory() {
    const name = newCatInput.trim()
    if (!name || form.categoryNames.includes(name)) { setNewCatInput(''); return }
    setForm(f => ({ ...f, categoryNames: [...f.categoryNames, name] }))
    setNewCatInput('')
  }

  function removeCategory(name: string) {
    setForm(f => ({ ...f, categoryNames: f.categoryNames.filter(c => c !== name) }))
  }

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this contact?')) return
    await fetch(`/api/connect/contacts/${id}`, { method: 'DELETE' })
    setContacts(cs => cs.filter(c => c.id !== id))
    if (expanded === id) setExpanded(null)
  }

  async function handleSave() {
    if (!form.fullName.trim()) { setFormError('Name is required'); return }
    setSaving(true); setFormError('')
    try {
      const url    = editId ? `/api/connect/contacts/${editId}` : '/api/connect/contacts'
      const method = editId ? 'PUT' : 'POST'
      const res    = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); setFormError(d.error ?? 'Error saving'); return }
      setShowForm(false)
      loadContacts()
      loadCategories()
    } catch (e) {
      setFormError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* ── ERP Nav Bar ──────────────────────────────────────────────────────── */}
      <div style={{ background: C.green, padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{ background: C.pabari, color: 'white', fontWeight: 800, fontSize: 11, padding: '5px 10px', borderRadius: 4, letterSpacing: '1px' }}>PABARI</div>
          </a>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>Connect</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={openAdd}
            style={{ background: C.pabari, color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
          >
            + Add Contact
          </button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>{currentUser.name}</span>
          <a href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>← Portal</a>
        </div>
      </div>

      {/* ── Search + Tabs ─────────────────────────────────────────────────────── */}
      <div style={{ position: 'sticky', top: 52, zIndex: 20, background: C.bg, padding: '14px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f2ead9', fontFamily: 'Georgia,serif' }}>Directory</h1>
          <span style={{ fontSize: 11, color: C.dim, fontFamily: 'monospace' }}>
            {loading ? 'Searching…' : `${contacts.length.toLocaleString()} shown`}
          </span>
        </div>

        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, company, country…"
          style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${C.border}`, background: C.input, padding: '11px 14px', fontSize: 14, color: C.text, outline: 'none' }}
        />

        <div style={{ position: 'relative', marginTop: 10 }}>
          {/* Left fade + arrow */}
          {canScrollLeft && (
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 1, zIndex: 2, display: 'flex', alignItems: 'center', background: `linear-gradient(to right, ${C.bg} 60%, transparent)`, paddingRight: 12 }}>
              <button onClick={() => scrollTabs('left')} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: C.muted, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
            </div>
          )}

          <div ref={tabsRef} style={{ display: 'flex', gap: 2, overflowX: 'auto', scrollbarWidth: 'none' as const }}>
            {['All', ...allCategories.map(c => c.name)].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flexShrink: 0, whiteSpace: 'nowrap', padding: '7px 13px',
                borderRadius: '8px 8px 0 0', border: `1px solid ${tab === t ? C.brass : C.border}`,
                borderBottom: 'none', background: tab === t ? C.brass : C.card,
                color: tab === t ? '#12151c' : C.muted, fontSize: 11, fontFamily: 'monospace',
                fontWeight: tab === t ? 700 : 400, cursor: 'pointer',
              }}>
                {t}
              </button>
            ))}
          </div>

          {/* Right fade + arrow */}
          {canScrollRight && (
            <div style={{ position: 'absolute', right: 0, top: 0, bottom: 1, zIndex: 2, display: 'flex', alignItems: 'center', background: `linear-gradient(to left, ${C.bg} 60%, transparent)`, paddingLeft: 12 }}>
              <button onClick={() => scrollTabs('right')} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, width: 26, height: 26, cursor: 'pointer', color: C.muted, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
            </div>
          )}
        </div>
        <div style={{ height: 1, background: C.border }} />
      </div>

      {/* ── Contact List ──────────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 720, margin: '0 auto', padding: '12px 20px 80px' }}>
        {!query.trim() && tab === 'All' && contacts.length === 0 && !loading && (
          <div style={{ padding: '60px 20px', textAlign: 'center', fontSize: 13, color: C.dim, lineHeight: 1.7 }}>
            Search a name, company, or country — or pick a category above.
          </div>
        )}

        {contacts.map(c => (
          <ContactCard
            key={c.id}
            contact={c}
            expanded={expanded === c.id}
            onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
            onCallRequest={() => setCallTarget(c)}
            onEdit={e => openEdit(c, e)}
            onDelete={e => handleDelete(c.id, e)}
            allCategories={allCategories}
            onCategoriesChanged={(id, cats) =>
              setContacts(prev => prev.map(x => x.id === id ? { ...x, categories: cats } : x))
            }
          />
        ))}
      </main>

      {/* ── Call confirm modal ───────────────────────────────────────────────── */}
      {callTarget && (
        <CallModal
          contact={callTarget}
          onCancel={() => setCallTarget(null)}
          onConfirm={() => { window.location.href = `tel:${callTarget.phone}`; setCallTarget(null) }}
        />
      )}

      {/* ── Add / Edit form panel ────────────────────────────────────────────── */}
      {showForm && (
        <div
          onClick={e => e.target === e.currentTarget && setShowForm(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div style={{ width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', borderRadius: '18px 18px 0 0', border: `1px solid ${C.border}`, borderBottom: 'none', background: '#161b24', padding: '0 0 32px' }}>

            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, background: '#161b24', zIndex: 1 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#f2ead9' }}>
                {editId ? 'Edit Contact' : 'New Contact'}
              </span>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: '20px 20px 0' }}>

              {/* Fields */}
              {[
                { label: 'Full Name *',   key: 'fullName',     type: 'text', placeholder: 'e.g. Jane Mwangi' },
                { label: 'Company',       key: 'companyName',  type: 'text', placeholder: 'e.g. Kenya Commercial Bank' },
                { label: 'Position',      key: 'position',     type: 'text', placeholder: 'e.g. Head of Finance' },
                { label: 'Phone',         key: 'phone',        type: 'tel',  placeholder: '+254 700 000 000' },
                { label: 'Email',         key: 'email',        type: 'email',placeholder: 'jane@company.com' },
                { label: 'Country',       key: 'country',      type: 'text', placeholder: 'Kenya' },
                { label: 'Address',       key: 'address',      type: 'text', placeholder: 'Westlands, Nairobi' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 5 }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    value={(form as Record<string, unknown>)[f.key] as string}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', boxSizing: 'border-box', background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 12px', fontSize: 13, color: C.text, outline: 'none' }}
                  />
                </div>
              ))}

              {/* Categories */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 5 }}>
                  Categories
                </label>

                {/* Selected chips */}
                {form.categoryNames.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {form.categoryNames.map(cat => (
                      <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(230,189,114,0.15)', border: `1px solid ${C.brass}`, borderRadius: 999, padding: '3px 10px', fontSize: 11, color: C.brass }}>
                        {cat}
                        <button onClick={() => removeCategory(cat)} style={{ background: 'none', border: 'none', color: C.brass, cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add category input */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={newCatInput}
                    onChange={e => setNewCatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                    placeholder="Type a category and press Enter or Add…"
                    list="cat-suggestions"
                    style={{ flex: 1, background: C.input, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 12px', fontSize: 13, color: C.text, outline: 'none' }}
                  />
                  <datalist id="cat-suggestions">
                    {allCategories.filter(c => !form.categoryNames.includes(c.name)).map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  <button
                    onClick={addCategory}
                    style={{ background: C.border, border: 'none', borderRadius: 8, padding: '0 14px', fontSize: 13, color: C.text, cursor: 'pointer', whiteSpace: 'nowrap' as const }}
                  >
                    Add
                  </button>
                </div>

                {/* Quick-pick existing categories */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
                  {allCategories.filter(c => !form.categoryNames.includes(c.name)).map(c => (
                    <button
                      key={c.id}
                      onClick={() => setForm(f => ({ ...f, categoryNames: [...f.categoryNames, c.name] }))}
                      style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 999, padding: '3px 10px', fontSize: 10, color: C.dim, cursor: 'pointer', fontFamily: 'monospace' }}
                    >
                      + {c.name}
                    </button>
                  ))}
                </div>
              </div>

              {formError && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: '#f87171', marginBottom: 14 }}>
                  {formError}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button
                  onClick={() => setShowForm(false)}
                  style={{ flex: 1, background: C.input, border: `1px solid ${C.border}`, borderRadius: 10, padding: 13, fontSize: 13, fontWeight: 600, color: C.muted, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 2, background: C.brass, border: 'none', borderRadius: 10, padding: 13, fontSize: 13, fontWeight: 700, color: '#12151c', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Saving…' : editId ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ContactCard ───────────────────────────────────────────────────────────────
function ContactCard({ contact, expanded, onToggle, onCallRequest, onEdit, onDelete, allCategories, onCategoriesChanged }: {
  contact: Contact
  expanded: boolean
  onToggle: () => void
  onCallRequest: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: (e: React.MouseEvent) => void
  allCategories: Category[]
  onCategoriesChanged: (id: number, cats: string[]) => void
}) {
  const c = contact
  const [catInput, setCatInput]   = useState('')
  const [catSaving, setCatSaving] = useState(false)

  const currentCats = c.categories ?? []

  async function patchCategories(next: string[]) {
    setCatSaving(true)
    onCategoriesChanged(c.id, next)
    await fetch(`/api/connect/contacts/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryNames: next }),
    }).catch(() => {})
    setCatSaving(false)
  }

  function addCat(name: string) {
    const n = name.trim()
    if (!n || currentCats.includes(n)) { setCatInput(''); return }
    patchCategories([...currentCats, n])
    setCatInput('')
  }

  function removeCat(name: string) {
    patchCategories(currentCats.filter(x => x !== name))
  }

  const available = allCategories.filter(a => !currentCats.includes(a.name))

  return (
    <div onClick={onToggle} style={{ position: 'relative', marginBottom: 8, cursor: 'pointer', overflow: 'hidden', borderRadius: 14, border: `1px solid ${expanded ? '#3d4a5c' : '#2b3242'}`, background: expanded ? '#1e2535' : '#1b202b', padding: '13px 13px 13px 18px', transition: 'background 0.15s' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: '#c4923f', borderRadius: '3px 0 0 3px' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f2ead9', fontFamily: 'Georgia,serif' }}>{c.full_name}</div>
          <div style={{ marginTop: 2, fontSize: 12, color: '#8b93a3' }}>
            {c.company_name}
            {c.position && <span style={{ color: '#b7bdc9' }}> · {c.position}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
            {c.country && <Tag>{c.country}</Tag>}
            {currentCats.map(cat => <Tag key={cat}>{cat}</Tag>)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
          <IconBtn label="Call" color="#e6bd72" disabled={!c.phone} onClick={e => { e.stopPropagation(); onCallRequest() }}>☎</IconBtn>
          <a aria-label="Email" href={c.email ? `mailto:${c.email}` : undefined} onClick={e => e.stopPropagation()}
            style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #2b3242', background: '#232a37', color: '#8fb3d6', fontSize: 13, opacity: c.email ? 1 : 0.25, pointerEvents: c.email ? 'auto' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
            ✉
          </a>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, borderTop: '1px dashed #2b3242', paddingTop: 10 }} onClick={e => e.stopPropagation()}>
          {c.phone   && <Row label="phone"   value={c.phone} />}
          {c.email   && <Row label="email"   value={c.email} />}
          {c.address && <Row label="address" value={c.address} />}

          {/* ── Inline category editor ─────────────────────────────────── */}
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #242b38' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#5c6272', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 7, display: 'flex', alignItems: 'center', gap: 6 }}>
              Categories
              {catSaving && <span style={{ fontSize: 9, color: '#e6bd72', fontWeight: 400 }}>saving…</span>}
            </div>

            {/* Current categories — tap × to remove */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
              {currentCats.length === 0 && (
                <span style={{ fontSize: 11, color: '#5c6272', fontStyle: 'italic' }}>No categories yet</span>
              )}
              {currentCats.map(cat => (
                <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(230,189,114,0.12)', border: '1px solid #e6bd72', borderRadius: 999, padding: '3px 8px', fontSize: 11, color: '#e6bd72' }}>
                  {cat}
                  <button
                    onClick={e => { e.stopPropagation(); removeCat(cat) }}
                    style={{ background: 'none', border: 'none', color: '#e6bd72', cursor: 'pointer', padding: '0 0 0 2px', fontSize: 13, lineHeight: 1 }}
                  >×</button>
                </span>
              ))}
            </div>

            {/* Quick-add existing categories */}
            {available.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {available.map(a => (
                  <button
                    key={a.id}
                    onClick={e => { e.stopPropagation(); addCat(a.name) }}
                    style={{ background: 'none', border: '1px solid #2b3242', borderRadius: 999, padding: '3px 9px', fontSize: 10, color: '#8b93a3', cursor: 'pointer', fontFamily: 'monospace' }}
                  >
                    + {a.name}
                  </button>
                ))}
              </div>
            )}

            {/* Type a new category */}
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={catInput}
                onChange={e => setCatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCat(catInput) } }}
                placeholder="New category…"
                onClick={e => e.stopPropagation()}
                style={{ flex: 1, background: '#232a37', border: '1px solid #2b3242', borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#e9e6de', outline: 'none' }}
              />
              <button
                onClick={e => { e.stopPropagation(); addCat(catInput) }}
                style={{ background: '#2b3242', border: 'none', borderRadius: 7, padding: '0 12px', fontSize: 12, color: '#8b93a3', cursor: 'pointer' }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Edit / Delete buttons */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={onEdit} style={{ flex: 1, background: '#232a37', border: '1px solid #3d4a5c', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, color: '#e6bd72', cursor: 'pointer' }}>
              Edit All Fields
            </button>
            <button onClick={onDelete} style={{ background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: 'rgba(239,68,68,0.6)', cursor: 'pointer' }}>
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ borderRadius: 999, border: '1px solid #2b3242', padding: '2px 7px', fontSize: 10, color: '#8b93a3', fontFamily: 'monospace' }}>
      {children}
    </span>
  )
}

function IconBtn({ label, color, disabled, onClick, children }: { label: string; color: string; disabled?: boolean; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} disabled={disabled} onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #2b3242', background: '#232a37', color, fontSize: 13, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.25 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </button>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12 }}>
      <span style={{ width: 52, flexShrink: 0, fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#5c6272' }}>{label}</span>
      <span style={{ color: '#c7cbd3', wordBreak: 'break-word' as const }}>{value}</span>
    </div>
  )
}

function CallModal({ contact, onCancel, onConfirm }: { contact: Contact; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div onClick={e => e.target === e.currentTarget && onCancel()}
      style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: 420, borderRadius: '16px 16px 0 0', border: '1px solid #2b3242', borderBottom: 'none', background: '#1b202b', padding: '20px 20px 32px' }}>
        <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#5c6272' }}>Call</div>
        <div style={{ marginTop: 6, textAlign: 'center', fontSize: 19, fontWeight: 700, color: '#f2ead9', fontFamily: 'Georgia,serif' }}>{contact.full_name}</div>
        <div style={{ marginTop: 4, textAlign: 'center', fontFamily: 'monospace', fontSize: 15, color: '#e6bd72' }}>{contact.phone}</div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onCancel} style={{ flex: 1, borderRadius: 12, border: '1px solid #2b3242', background: '#232a37', padding: 13, fontSize: 13, fontWeight: 600, color: '#8b93a3', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, borderRadius: 12, border: '1px solid #e6bd72', background: '#e6bd72', padding: 13, fontSize: 13, fontWeight: 700, color: '#12151c', cursor: 'pointer' }}>Call</button>
        </div>
      </div>
    </div>
  )
}
