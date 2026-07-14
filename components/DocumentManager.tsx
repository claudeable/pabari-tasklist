'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SessionUser } from '@/types'
import { DOC_ENTITIES } from '@/lib/doc-constants'
import InactivityGuard from './InactivityGuard'

interface DocMeta {
  id: number; name: string; entity: string; folder: string
  doc_type: string; expiry_date: string | null
  mime_type: string; size: number
  uploaded_by: string; uploader_name: string; created_at: string
  reference_no: string | null; description: string; year: number
}
interface FolderSummary { name: string; count: number; expiring_count: number }
interface Props { currentUser: SessionUser }

const DOC_TYPES = ['', 'Certificate', 'Licence', 'Permit', 'Resolution', 'Agreement', 'Report', 'Policy', 'Invoice', 'Other']

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}
function fileIcon(mime: string, name: string) {
  if (mime.startsWith('image/'))                                    return '🖼️'
  if (mime === 'application/pdf' || /\.pdf$/i.test(name))         return '📄'
  if (mime.includes('word')  || /\.(docx?|odt)$/i.test(name))    return '📝'
  if (mime.includes('sheet') || /\.(xlsx?|csv|ods)$/i.test(name)) return '📊'
  if (mime.includes('presentation') || /\.(pptx?)$/i.test(name))  return '📈'
  if (mime.includes('zip')  || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return '🗜️'
  return '📄'
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  return diff
}

function ExpiryBadge({ expiry_date }: { expiry_date: string | null }) {
  const days = daysUntil(expiry_date)
  if (days === null) return null
  if (days < 0)  return <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#7f1d1d', borderRadius: 4, padding: '2px 8px' }}>EXPIRED</span>
  if (days === 0) return <span style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#dc2626', borderRadius: 4, padding: '2px 8px' }}>Expires today</span>
  if (days <= 7)  return <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>Expires in {days} day{days !== 1 ? 's' : ''}</span>
  if (days <= 30) return <span style={{ fontSize: 11, fontWeight: 700, color: '#d97706' }}>Expires in {days} days</span>
  return <span style={{ fontSize: 11, color: '#9ca3af' }}>Expires {fmtDate(expiry_date!)}</span>
}

export default function DocumentManager({ currentUser }: Props) {
  const [entity,       setEntity]       = useState<string>('Group')
  const [folders,      setFolders]      = useState<FolderSummary[]>([])
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const [docs,         setDocs]         = useState<DocMeta[]>([])
  const [expiringAll,  setExpiringAll]  = useState<DocMeta[]>([])
  const [expiringCount, setExpiringCount] = useState(0)
  const [allFolderNames, setAllFolderNames] = useState<string[]>([])
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(false)
  const [showExpiring, setShowExpiring] = useState(false)

  // Upload
  const [showUpload,  setShowUpload]  = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadFile,  setUploadFile]  = useState<File | null>(null)
  const [uploadForm,  setUploadForm]  = useState({ entity: 'Group', folder: '', doc_type: '', has_expiry: false, expiry_date: '', reference_no: '', description: '', year: new Date().getFullYear() })
  const [uploadError, setUploadError] = useState('')
  const [dragging,    setDragging]    = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Delete
  const [delId,    setDelId]    = useState<number | null>(null)
  const [delError, setDelError] = useState('')

  // Move
  const [moveDoc,    setMoveDoc]    = useState<DocMeta | null>(null)
  const [moveFolder, setMoveFolder] = useState('')

  // Edit expiry
  const [editExpiry,     setEditExpiry]     = useState<DocMeta | null>(null)
  const [editExpiryVal,  setEditExpiryVal]  = useState('')
  const [editExpirySaving, setEditExpirySaving] = useState(false)

  // Folder management
  const [showNewFolder,  setShowNewFolder]  = useState(false)
  const [newFolderName,  setNewFolderName]  = useState('')
  const [folderSaving,   setFolderSaving]   = useState(false)
  const [folderError,    setFolderError]    = useState('')
  const [renameTarget,   setRenameTarget]   = useState<string | null>(null)
  const [renameVal,      setRenameVal]      = useState('')
  const [delFolderName,  setDelFolderName]  = useState<string | null>(null)
  const [delFolderError, setDelFolderError] = useState('')

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  // Preview
  const [previewDoc,     setPreviewDoc]     = useState<DocMeta | null>(null)
  const [previewSrc,     setPreviewSrc]     = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  function isOfficeFile(mime: string, name: string) {
    return mime.includes('word') || mime.includes('sheet') || mime.includes('presentation') ||
      /\.(docx?|xlsx?|pptx?|odt|ods|odp)$/i.test(name)
  }

  async function openPreview(doc: DocMeta) {
    const mime = doc.mime_type || ''
    const isPdf   = mime === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf')
    const isImage = mime.startsWith('image/')
    const isOffice = isOfficeFile(mime, doc.name)

    if (isPdf || isImage) {
      // Direct URL works for PDF/images on all devices
      setPreviewDoc(doc)
      setPreviewSrc(`/api/documents/${doc.id}`)
      return
    }

    if (isOffice) {
      setPreviewLoading(true)
      try {
        const res = await fetch(`/api/documents/${doc.id}/viewtoken`, { method: 'POST', credentials: 'include' })
        const { token } = await res.json()
        const fileUrl = `${window.location.origin}/api/documents/view/${token}`
        const viewerUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`

        if (isMobile) {
          // Office Online iframe doesn't work in mobile browsers — open new tab
          window.open(viewerUrl, '_blank')
          setPreviewLoading(false)
          return
        }

        setPreviewDoc(doc)
        setPreviewSrc(viewerUrl)
      } catch {
        setPreviewDoc(doc)
        setPreviewSrc(null)
      } finally {
        setPreviewLoading(false)
      }
      return
    }

    // Unknown type — show download prompt
    setPreviewDoc(doc)
    setPreviewSrc(null)
  }

  function closePreview() { setPreviewDoc(null); setPreviewSrc(null) }

  const isAdmin = currentUser.role === 'admin'
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const loadFolders = useCallback(async (ent: string) => {
    const res = await fetch(`/api/documents?mode=folder-summaries&entity=${encodeURIComponent(ent)}`, { credentials: 'include' })
    if (res.ok) setFolders(await res.json())
  }, [])

  const loadFolderNames = useCallback(async () => {
    const res = await fetch('/api/documents?mode=folder-names', { credentials: 'include' })
    if (res.ok) setAllFolderNames(await res.json())
  }, [])

  const loadDocs = useCallback(async (ent: string, folder: string | null) => {
    setLoading(true)
    const url = folder
      ? `/api/documents?entity=${encodeURIComponent(ent)}&folder=${encodeURIComponent(folder)}`
      : `/api/documents?entity=${encodeURIComponent(ent)}`
    const res = await fetch(url, { credentials: 'include' })
    if (res.ok) setDocs(await res.json())
    setLoading(false)
  }, [])

  const loadExpiring = useCallback(async () => {
    const [countRes, listRes] = await Promise.all([
      fetch('/api/documents?mode=expiring-count', { credentials: 'include' }),
      fetch('/api/documents?mode=expiring', { credentials: 'include' }),
    ])
    if (countRes.ok) setExpiringCount((await countRes.json()).count)
    if (listRes.ok)  setExpiringAll(await listRes.json())
  }, [])

  useEffect(() => {
    loadFolders(entity); loadFolderNames(); loadExpiring()
  }, [entity, loadFolders, loadFolderNames, loadExpiring])

  useEffect(() => {
    if (activeFolder !== null || entity) loadDocs(entity, activeFolder)
  }, [entity, activeFolder, loadDocs])

  const selectEntity = (ent: string) => { setEntity(ent); setActiveFolder(null) }
  const selectFolder = (f: string | null) => { setActiveFolder(f); setSearch('') }

  const activeFolderData = folders.find(f => f.name === activeFolder)

  const filtered = docs.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.doc_type.toLowerCase().includes(search.toLowerCase()) ||
    d.uploader_name.toLowerCase().includes(search.toLowerCase())
  )

  // ── Upload ──────────────────────────────────────────────────────────────────
  const openUpload = () => {
    setUploadFile(null); setUploadError('')
    setUploadForm({ entity, folder: activeFolder || allFolderNames[0] || '', doc_type: '', has_expiry: false, expiry_date: '', reference_no: '', description: '', year: new Date().getFullYear() })
    setShowUpload(true)
  }

  const doUpload = async () => {
    if (!uploadFile)          { setUploadError('Select a file'); return }
    if (!uploadForm.folder)   { setUploadError('Choose a folder'); return }
    if (uploadForm.has_expiry && !uploadForm.expiry_date) { setUploadError('Enter an expiry date'); return }
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file',         uploadFile)
      fd.append('entity',       uploadForm.entity)
      fd.append('folder',       uploadForm.folder)
      fd.append('doc_type',     uploadForm.doc_type)
      fd.append('expiry_date',  uploadForm.has_expiry ? uploadForm.expiry_date : '')
      fd.append('reference_no', uploadForm.reference_no)
      fd.append('description',  uploadForm.description)
      fd.append('year',         String(uploadForm.year))
      const res  = await fetch('/api/documents', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setShowUpload(false)
      await loadFolders(entity); await loadExpiring()
      if (uploadForm.entity === entity) {
        if (activeFolder === null || activeFolder === uploadForm.folder) {
          setDocs(d => [data.doc, ...d])
        } else {
          setActiveFolder(uploadForm.folder)
        }
      }
    } catch (e: unknown) { setUploadError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  // ── Delete file ─────────────────────────────────────────────────────────────
  const doDelete = async () => {
    if (delId === null) return
    const res = await fetch(`/api/documents/${delId}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) { setDelError('Delete failed'); return }
    setDocs(d => d.filter(x => x.id !== delId))
    setExpiringAll(d => d.filter(x => x.id !== delId))
    await loadFolders(entity); await loadExpiring(); setDelId(null)
  }

  // ── Move file ───────────────────────────────────────────────────────────────
  const doMove = async () => {
    if (!moveDoc || !moveFolder) return
    const res = await fetch(`/api/documents/${moveDoc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ folder: moveFolder }),
    })
    if (res.ok) {
      setDocs(d => d.filter(x => x.id !== moveDoc.id))
      await loadFolders(entity); setMoveDoc(null)
    }
  }

  // ── Edit expiry ─────────────────────────────────────────────────────────────
  const doSaveExpiry = async () => {
    if (!editExpiry) return
    setEditExpirySaving(true)
    const res = await fetch(`/api/documents/${editExpiry.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ expiry_date: editExpiryVal || null }),
    })
    if (res.ok) {
      const newDate = editExpiryVal || null
      setDocs(d => d.map(x => x.id === editExpiry.id ? { ...x, expiry_date: newDate } : x))
      setExpiringAll(d => d.filter(x => x.id !== editExpiry.id))
      await loadFolders(entity); await loadExpiring(); setEditExpiry(null)
    }
    setEditExpirySaving(false)
  }

  // ── Folder management ───────────────────────────────────────────────────────
  const doCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { setFolderError('Enter a name'); return }
    setFolderSaving(true); setFolderError('')
    try {
      const res  = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'create-folder', name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setShowNewFolder(false); setNewFolderName('')
      await loadFolders(entity); await loadFolderNames()
    } catch (e: unknown) { setFolderError(e instanceof Error ? e.message : 'Error') }
    finally { setFolderSaving(false) }
  }

  const doRenameFolder = async () => {
    if (!renameTarget || !renameVal.trim()) return
    const res = await fetch('/api/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'rename-folder', oldName: renameTarget, newName: renameVal.trim() }),
    })
    if (res.ok) {
      if (activeFolder === renameTarget) setActiveFolder(renameVal.trim())
      await loadFolders(entity); await loadFolderNames(); await loadDocs(entity, activeFolder === renameTarget ? renameVal.trim() : activeFolder)
      setRenameTarget(null)
    }
  }

  const doDeleteFolder = async () => {
    if (!delFolderName) return
    setDelFolderError('')
    const res  = await fetch('/api/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'delete-folder', name: delFolderName }),
    })
    const data = await res.json()
    if (!res.ok) { setDelFolderError(data.error || 'Failed'); return }
    if (activeFolder === delFolderName) setActiveFolder(null)
    await loadFolders(entity); await loadFolderNames(); setDelFolderName(null)
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const modal: React.CSSProperties   = { background: 'white', borderRadius: 10, padding: 28, width: 480, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }
  const inp: React.CSSProperties     = { border: '1px solid #d1d5db', borderRadius: 5, padding: '8px 11px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties     = { display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }
  const btnP: React.CSSProperties    = { background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
  const btnG: React.CSSProperties    = { border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', background: '#f9fafb' }}>
      <InactivityGuard />

      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <div style={{ background: '#1a3a2a', padding: '0 14px', display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12, height: 50, flexShrink: 0 }}>
        <span style={{ background: '#b5833a', color: 'white', fontWeight: 800, fontSize: 11, padding: '4px 9px', borderRadius: 4, letterSpacing: '1px' }}>PABARI</span>
        {!isMobile && <>
          <a href="/" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 12 }}>← Portal</a>
          <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }}/>
          <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>Document Management</span>
        </>}
        {isMobile && <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>Documents</span>}
        <div style={{ flex: 1 }}/>
        {expiringCount > 0 && (
          <button onClick={() => setShowExpiring(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', color: '#fca5a5', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ⚠{!isMobile && ' Expiring'}
            <span style={{ background: '#dc2626', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{expiringCount}</span>
          </button>
        )}
        <button onClick={openUpload}
          style={{ background: '#b5833a', color: 'white', border: 'none', borderRadius: 5, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          ↑ {isMobile ? '' : 'Upload'}
        </button>
        {!isMobile && <>
          <a href="/audit" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 12 }}>Activity Log</a>
          {isAdmin && <a href="/admin/users" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 12 }}>Users</a>}
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{currentUser.name}</span>
          <a href="/api/auth/logout" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: 12 }}>Sign out</a>
        </>}
        {isMobile && <a href="/" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 12 }}>← Portal</a>}
      </div>

      {/* ── MAIN LAYOUT ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', overflow: 'hidden' }}>

        {/* SIDEBAR (desktop) / TOP STRIP (mobile) */}
        <div style={isMobile
          ? { background: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }
          : { width: sidebarCollapsed ? 0 : 240, minWidth: sidebarCollapsed ? 0 : 240, background: 'white', borderRight: sidebarCollapsed ? 'none' : '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden', transition: 'width 0.2s ease, min-width 0.2s ease' }}>

          {/* Entity selector */}
          {!isMobile ? (
            <div style={{ padding: '16px 16px 8px' }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 6 }}>Entity</div>
              <select value={entity} onChange={e => selectEntity(e.target.value)}
                style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', fontSize: 13, fontWeight: 600, color: '#111', background: 'white', cursor: 'pointer', outline: 'none' }}>
                {DOC_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ padding: '10px 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <select value={entity} onChange={e => selectEntity(e.target.value)}
                style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '7px 10px', fontSize: 13, fontWeight: 600, color: '#111', background: 'white', cursor: 'pointer', outline: 'none', flex: 1 }}>
                {DOC_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <button onClick={() => { setShowNewFolder(true); setNewFolderName(''); setFolderError('') }}
                style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', color: '#374151', borderRadius: 6, padding: '7px 12px', fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Folder
              </button>
            </div>
          )}

          {/* Folders — vertical list on desktop, horizontal chips on mobile */}
          {!isMobile ? (
            <div style={{ flex: 1, overflow: 'auto', paddingTop: 8 }}>
              <div style={{ padding: '4px 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', letterSpacing: '1px', textTransform: 'uppercase' }}>Folders</div>
                <button onClick={() => { setShowNewFolder(true); setNewFolderName(''); setFolderError('') }}
                  style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 18, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }} title="New folder">+</button>
              </div>

              <button onClick={() => selectFolder(null)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                  background: activeFolder === null ? '#f0fdf4' : 'transparent',
                  borderLeft: activeFolder === null ? '3px solid #1a3a2a' : '3px solid transparent',
                  color: activeFolder === null ? '#1a3a2a' : '#374151',
                  fontWeight: activeFolder === null ? 700 : 400, fontSize: 13 }}>
                <span>All Documents</span>
                <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', borderRadius: 10, padding: '1px 7px' }}>{docs.length || ''}</span>
              </button>

              {folders.map(f => (
                <div key={f.name} style={{ position: 'relative' }}
                  onMouseEnter={e => (e.currentTarget.querySelector('.folder-actions') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('.folder-actions') as HTMLElement).style.display = 'flex')}
                  onMouseLeave={e => (e.currentTarget.querySelector('.folder-actions') as HTMLElement | null)?.style && ((e.currentTarget.querySelector('.folder-actions') as HTMLElement).style.display = 'none')}>
                  <button onClick={() => selectFolder(f.name)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '8px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: activeFolder === f.name ? '#f0fdf4' : 'transparent',
                      borderLeft: activeFolder === f.name ? '3px solid #1a3a2a' : '3px solid transparent',
                      color: activeFolder === f.name ? '#1a3a2a' : '#374151',
                      fontWeight: activeFolder === f.name ? 700 : 400, fontSize: 13 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 4 }}>{f.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {f.expiring_count > 0 && (
                        <span style={{ background: '#fee2e2', color: '#dc2626', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '0 5px' }}>{f.expiring_count}</span>
                      )}
                      <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', borderRadius: 10, padding: '1px 7px' }}>{f.count}</span>
                    </div>
                  </button>
                  <div className="folder-actions" style={{ display: 'none', position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', gap: 2, background: 'white', borderRadius: 4, boxShadow: '0 1px 4px rgba(0,0,0,0.15)', zIndex: 5, padding: '2px' }}>
                    <button onClick={e => { e.stopPropagation(); setRenameTarget(f.name); setRenameVal(f.name) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#6b7280', padding: '3px 6px' }}>✏️</button>
                    <button onClick={e => { e.stopPropagation(); setDelFolderName(f.name); setDelFolderError('') }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#dc2626', padding: '3px 6px' }}>🗑</button>
                  </div>
                </div>
              ))}

              {folders.length === 0 && (
                <div style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af' }}>
                  No folders yet.
                  <button onClick={() => { setShowNewFolder(true); setNewFolderName('') }}
                    style={{ background: 'none', border: 'none', color: '#1a3a2a', cursor: 'pointer', textDecoration: 'underline', fontSize: 12, padding: 0, marginLeft: 4 }}>
                    Create one
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Mobile: horizontal scrolling folder chips */
            <div style={{ overflowX: 'auto', display: 'flex', gap: 8, padding: '10px 12px', scrollbarWidth: 'none' }}>
              <button onClick={() => selectFolder(null)}
                style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  background: activeFolder === null ? '#1a3a2a' : '#f3f4f6',
                  color: activeFolder === null ? 'white' : '#374151' }}>
                All <span style={{ opacity: 0.7, fontWeight: 400 }}>({docs.length})</span>
              </button>
              {folders.map(f => (
                <button key={f.name} onClick={() => selectFolder(f.name)}
                  style={{ flexShrink: 0, padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                    background: activeFolder === f.name ? '#1a3a2a' : '#f3f4f6',
                    color: activeFolder === f.name ? 'white' : '#374151' }}>
                  {f.name}
                  {f.expiring_count > 0 && <span style={{ background: '#dc2626', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 8, padding: '0 5px' }}>{f.expiring_count}</span>}
                  <span style={{ opacity: 0.6, fontWeight: 400 }}>({f.count})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Search bar */}
          <div style={{ padding: isMobile ? '10px 12px' : '14px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {!isMobile && (
              <button onClick={() => setSidebarCollapsed(v => !v)} title={sidebarCollapsed ? 'Show folders' : 'Hide folders'}
                style={{ background: 'none', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: '#6b7280', fontSize: 14, flexShrink: 0, lineHeight: 1 }}>
                {sidebarCollapsed ? '▶' : '◀'}
              </button>
            )}
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: 15 }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={isMobile ? 'Search…' : 'Search documents by name, type or uploader…'}
                style={{ ...inp, paddingLeft: 36, fontSize: 13 }}/>
            </div>
          </div>

          {/* Folder header */}
          <div style={{ padding: isMobile ? '12px 12px 0' : '16px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: isMobile ? 15 : 17, color: '#111' }}>
                  {activeFolder || 'All Documents'}{!isMobile && ` — ${entity}`}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {filtered.length} document{filtered.length !== 1 ? 's' : ''}
                </div>
              </div>
              {!isMobile && (
                <button onClick={openUpload}
                  style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  + Upload
                </button>
              )}
            </div>

            {/* Expiry warning banner */}
            {activeFolderData && activeFolderData.expiring_count > 0 && (
              <div style={{ marginTop: 14, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span style={{ fontSize: 13, color: '#92400e' }}>
                  <strong>{activeFolderData.expiring_count}</strong> document{activeFolderData.expiring_count !== 1 ? 's' : ''} in this folder require renewal attention.
                </span>
              </div>
            )}
          </div>

          {/* Document list */}
          <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '12px 12px' : '16px 24px' }}>
            {loading ? (
              <div style={{ color: '#9ca3af', fontSize: 14, padding: 20 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>
                  {search ? 'No documents match your search' : `No documents here yet for ${entity}`}
                </div>
                {!search && (
                  <button onClick={openUpload} style={{ ...btnP, marginTop: 16 }}>Upload a document</button>
                )}
              </div>
            ) : (
              <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                {filtered.map((doc, i) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 14, padding: isMobile ? '14px 14px' : '14px 18px', borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : 'none', flexDirection: isMobile ? 'column' : 'row' }}>
                    {/* Top row on mobile: icon + name + download */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
                      {/* Icon */}
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {fileIcon(doc.mime_type, doc.name)}
                      </div>

                      {/* Name + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button onClick={() => openPreview(doc)}
                            style={{ fontWeight: 600, fontSize: 14, color: '#1a3a2a', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                            {doc.name}
                          </button>
                          {doc.reference_no && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', borderRadius: 4, padding: '1px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                              {doc.reference_no}
                            </span>
                          )}
                          {!isMobile && <span style={{ fontSize: 10, color: '#d1d5db', flexShrink: 0 }}>{doc.year}</span>}
                        </div>
                        {doc.description && (
                          <div style={{ fontSize: 12, color: '#4b5563', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.description}</div>
                        )}
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                          {[doc.doc_type, `${fmtDate(doc.created_at)} · ${doc.uploader_name || doc.uploaded_by}`].filter(Boolean).join(' · ')}
                          {!activeFolder && <span style={{ marginLeft: 6, background: '#f3f4f6', borderRadius: 4, padding: '1px 6px' }}>📁 {doc.folder}</span>}
                        </div>
                      </div>

                      {!isMobile && (
                        /* Expiry (desktop only — shown in actions row on mobile) */
                        <div style={{ flexShrink: 0, minWidth: 120, textAlign: 'right' }}>
                          <ExpiryBadge expiry_date={doc.expiry_date} />
                        </div>
                      )}
                    </div>

                    {/* Actions row */}
                    <div style={{ display: 'flex', gap: isMobile ? 8 : 4, flexShrink: 0, width: isMobile ? '100%' : undefined, alignItems: 'center' }}>
                      {isMobile && <ExpiryBadge expiry_date={doc.expiry_date} />}
                      {isMobile && <div style={{ flex: 1 }} />}
                      <button onClick={() => openPreview(doc)} title="View" disabled={previewLoading}
                        style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: isMobile ? 6 : 4, padding: isMobile ? '8px 16px' : '4px 9px', fontSize: isMobile ? 13 : 11, fontWeight: isMobile ? 600 : 400, cursor: previewLoading ? 'wait' : 'pointer', whiteSpace: 'nowrap', opacity: previewLoading ? 0.7 : 1 }}>
                        {isMobile ? (previewLoading ? '⏳ Opening…' : '👁 View') : '👁'}
                      </button>
                      <a href={`/api/documents/${doc.id}?download=1`} title="Download"
                        style={{ background: 'white', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: isMobile ? 6 : 4, padding: isMobile ? '8px 14px' : '4px 9px', fontSize: isMobile ? 13 : 11, textDecoration: 'none', fontWeight: isMobile ? 600 : 400, whiteSpace: 'nowrap' }}>
                        {isMobile ? '↓ Download' : '↓'}
                      </a>
                      {!isMobile && (
                        <>
                          <button onClick={() => { setEditExpiry(doc); setEditExpiryVal(doc.expiry_date || '') }} title="Set expiry date"
                            style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>📅</button>
                          <button onClick={() => { setMoveDoc(doc); setMoveFolder(doc.folder) }} title="Move to folder"
                            style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>Move</button>
                          <button onClick={() => { setDelId(doc.id); setDelError('') }} title="Delete"
                            style={{ background: 'white', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: 4, padding: '4px 9px', fontSize: 11, cursor: 'pointer' }}>🗑</button>
                        </>
                      )}
                      {isMobile && (
                        <button onClick={() => { setDelId(doc.id); setDelError('') }} title="Delete"
                          style={{ background: 'white', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: 6, padding: '8px 12px', fontSize: 13, cursor: 'pointer' }}>🗑</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ PREVIEW MODAL ══════════════════════════════════════════════════ */}
      {previewDoc && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column' }}
          onClick={e => { if (e.target === e.currentTarget) closePreview() }}>
          {/* Header */}
          <div style={{ background: '#1a3a2a', padding: '0 16px', height: 52, display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: 'white', fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewDoc.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{fmtSize(previewDoc.size)}</div>
            </div>
            <a href={`/api/documents/${previewDoc.id}?download=1`}
              style={{ background: '#b5833a', color: 'white', padding: '7px 14px', borderRadius: 5, fontSize: 12, fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
              ↓ Download
            </a>
            <button onClick={closePreview}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: 5, padding: '6px 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
              ✕ Close
            </button>
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {previewLoading && (
              <div style={{ color: 'white', textAlign: 'center' }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 14 }}>Preparing document viewer…</div>
              </div>
            )}
            {!previewLoading && previewSrc && (() => {
              const mime = previewDoc.mime_type || ''
              if (mime.startsWith('image/')) {
                return <img src={previewSrc} alt={previewDoc.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              }
              return (
                <iframe src={previewSrc} title={previewDoc.name}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'white' }} />
              )
            })()}
            {!previewLoading && !previewSrc && (
              <div style={{ color: 'white', textAlign: 'center', padding: 32 }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>{fileIcon(previewDoc.mime_type || '', previewDoc.name)}</div>
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 8 }}>{previewDoc.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 24 }}>
                  This file type can&apos;t be previewed. Download it to open with the appropriate app.
                </div>
                <a href={`/api/documents/${previewDoc.id}?download=1`}
                  style={{ background: '#b5833a', color: 'white', padding: '12px 24px', borderRadius: 6, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
                  ↓ Download {previewDoc.name}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ EXPIRING PANEL ══════════════════════════════════════════════════ */}
      {showExpiring && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowExpiring(false) }}>
          <div style={{ ...modal, width: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>⚠ Expiring Documents ({expiringCount})</div>
              <button onClick={() => setShowExpiring(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div style={{ overflow: 'auto', flex: 1 }}>
              {expiringAll.length === 0 ? (
                <div style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: 30 }}>No expiring documents</div>
              ) : expiringAll.map(doc => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{doc.entity} · {doc.folder}</div>
                    </div>
                    <ExpiryBadge expiry_date={doc.expiry_date} />
                    <button onClick={() => { setEditExpiry(doc); setEditExpiryVal(doc.expiry_date || ''); setShowExpiring(false) }}
                      style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '3px 9px', fontSize: 11, cursor: 'pointer', flexShrink: 0 }}>Renew</button>
                  </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ UPLOAD MODAL ════════════════════════════════════════════════════ */}
      {showUpload && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowUpload(false) }}>
          <div style={modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Upload Document</div>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) setUploadFile(e.dataTransfer.files[0]) }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#1a3a2a' : uploadFile ? '#86efac' : '#d1d5db'}`, borderRadius: 8, padding: '22px 20px', textAlign: 'center', cursor: 'pointer', background: uploadFile || dragging ? '#f0fdf4' : '#fafafa', marginBottom: 18 }}>
              {uploadFile ? (
                <>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{fileIcon(uploadFile.type, uploadFile.name)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{uploadFile.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtSize(uploadFile.size)} · click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Drag & drop or click to browse</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>Max 20 MB</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setUploadFile(e.target.files[0])} />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Entity / Company</label>
                <select value={uploadForm.entity} onChange={e => setUploadForm(f => ({ ...f, entity: e.target.value }))} style={{ ...inp }}>
                  {DOC_ENTITIES.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Folder / Category</label>
                <select value={uploadForm.folder} onChange={e => setUploadForm(f => ({ ...f, folder: e.target.value }))} style={{ ...inp }}>
                  <option value="">— Select —</option>
                  {allFolderNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Document Type (optional)</label>
                <select value={uploadForm.doc_type} onChange={e => setUploadForm(f => ({ ...f, doc_type: e.target.value }))} style={{ ...inp }}>
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t || '— None —'}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Year</label>
                <input type="number" value={uploadForm.year} onChange={e => setUploadForm(f => ({ ...f, year: parseInt(e.target.value) || new Date().getFullYear() }))}
                  min={2000} max={2100} style={{ ...inp }}/>
              </div>
              <div>
                <label style={lbl}>Reference No. (optional)</label>
                <input type="text" value={uploadForm.reference_no} onChange={e => setUploadForm(f => ({ ...f, reference_no: e.target.value }))}
                  placeholder="e.g. HKA.1025" style={{ ...inp }}/>
              </div>
              <div>
                <label style={lbl}>
                  <input type="checkbox" checked={uploadForm.has_expiry} onChange={e => setUploadForm(f => ({ ...f, has_expiry: e.target.checked }))} style={{ marginRight: 5 }}/>
                  Has Expiry Date
                </label>
                {uploadForm.has_expiry && (
                  <input type="date" value={uploadForm.expiry_date} onChange={e => setUploadForm(f => ({ ...f, expiry_date: e.target.value }))} style={{ ...inp }} min={new Date().toISOString().slice(0, 10)}/>
                )}
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Description / Particulars (optional)</label>
              <textarea value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief description of what this document is about…"
                rows={2} style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }}/>
            </div>

            {uploadError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{uploadError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(false)} style={btnG}>Cancel</button>
              <button onClick={doUpload} disabled={uploading || !uploadFile} style={{ ...btnP, opacity: uploading || !uploadFile ? 0.6 : 1, cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer' }}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ EDIT EXPIRY ════════════════════════════════════════════════════ */}
      {editExpiry && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setEditExpiry(null) }}>
          <div style={{ ...modal, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Set Expiry Date</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{editExpiry.name}</div>
            <label style={lbl}>Expiry Date (leave blank to remove)</label>
            <input type="date" value={editExpiryVal} onChange={e => setEditExpiryVal(e.target.value)}
              style={{ ...inp, marginBottom: 20 }}/>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditExpiry(null)} style={btnG}>Cancel</button>
              {editExpiry.expiry_date && (
                <button onClick={() => { setEditExpiryVal(''); doSaveExpiry() }}
                  style={{ ...btnG, color: '#dc2626', borderColor: '#fee2e2' }}>Remove</button>
              )}
              <button onClick={doSaveExpiry} disabled={editExpirySaving} style={{ ...btnP, opacity: editExpirySaving ? 0.7 : 1 }}>
                {editExpirySaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE FILE ═════════════════════════════════════════════════════ */}
      {delId !== null && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDelId(null) }}>
          <div style={{ ...modal, width: 360 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Delete Document?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This will permanently delete the file and cannot be undone.</div>
            {delError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{delError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDelId(null)} style={btnG}>Cancel</button>
              <button onClick={doDelete} style={{ ...btnP, background: '#dc2626' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOVE FILE ═══════════════════════════════════════════════════════ */}
      {moveDoc && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setMoveDoc(null) }}>
          <div style={{ ...modal, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Move to Folder</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{moveDoc.name}</div>
            <label style={lbl}>Target Folder</label>
            <select value={moveFolder} onChange={e => setMoveFolder(e.target.value)} style={{ ...inp, marginBottom: 20 }}>
              <option value="">— Select —</option>
              {allFolderNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMoveDoc(null)} style={btnG}>Cancel</button>
              <button onClick={doMove} style={btnP}>Move</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ NEW FOLDER ══════════════════════════════════════════════════════ */}
      {showNewFolder && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowNewFolder(false) }}>
          <div style={{ ...modal, width: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Create Folder</div>
            <label style={lbl}>Folder / Category Name</label>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreateFolder()}
              placeholder="e.g. Corporate & Legal, Finance & Audit, HR…"
              style={{ ...inp, marginBottom: 16 }}/>
            {folderError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{folderError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewFolder(false)} style={btnG}>Cancel</button>
              <button onClick={doCreateFolder} disabled={folderSaving} style={{ ...btnP, opacity: folderSaving ? 0.7 : 1 }}>{folderSaving ? 'Creating…' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RENAME FOLDER ═══════════════════════════════════════════════════ */}
      {renameTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setRenameTarget(null) }}>
          <div style={{ ...modal, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Rename Folder</div>
            <label style={lbl}>New Name</label>
            <input autoFocus value={renameVal} onChange={e => setRenameVal(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doRenameFolder()}
              style={{ ...inp, marginBottom: 20 }}/>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameTarget(null)} style={btnG}>Cancel</button>
              <button onClick={doRenameFolder} style={btnP}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE FOLDER ════════════════════════════════════════════════════ */}
      {delFolderName && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDelFolderName(null) }}>
          <div style={{ ...modal, width: 360 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Delete Folder?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              Delete folder <strong>"{delFolderName}"</strong>? All documents in it must be removed first.
            </div>
            {delFolderError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{delFolderError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDelFolderName(null)} style={btnG}>Cancel</button>
              <button onClick={doDeleteFolder} style={{ ...btnP, background: '#dc2626' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ background: '#1a3a2a', color: 'rgba(255,255,255,0.5)', fontSize: 10.5, padding: '5px 20px', display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>PABARI GROUP</span>
        <span>·</span><span>Document Library</span>
        <span>·</span><span>{currentUser.name}</span>
      </div>
    </div>
  )
}
