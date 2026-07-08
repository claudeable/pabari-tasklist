'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SessionUser } from '@/types'
import InactivityGuard from './InactivityGuard'

interface DocMeta {
  id: number; name: string; folder: string; mime_type: string
  size: number; uploaded_by: string; uploader_name: string; created_at: string
}
interface FolderRecord { name: string; count: number; created_at: string }
interface Props { currentUser: SessionUser }

function fmtSize(bytes: number): string {
  if (bytes < 1024)    return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileIcon(mime: string, name: string): string {
  if (mime.startsWith('image/'))                                   return '🖼️'
  if (mime === 'application/pdf' || /\.pdf$/i.test(name))        return '📄'
  if (mime.includes('word')  || /\.(docx?|odt)$/i.test(name))   return '📝'
  if (mime.includes('sheet') || /\.(xlsx?|csv|ods)$/i.test(name)) return '📊'
  if (mime.includes('presentation') || /\.(pptx?|odp)$/i.test(name)) return '📈'
  if (mime.includes('zip')  || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return '🗜️'
  if (mime.startsWith('text/') || /\.(txt|md|json|xml)$/i.test(name)) return '📃'
  return '📁'
}

export default function DocumentManager({ currentUser }: Props) {
  const [activeTab,    setActiveTab]    = useState<'documents' | 'folders'>('documents')
  const [folders,      setFolders]      = useState<FolderRecord[]>([])
  const [docs,         setDocs]         = useState<DocMeta[]>([])
  const [filterFolder, setFilterFolder] = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [loading,      setLoading]      = useState(true)

  // Upload state
  const [showUpload,   setShowUpload]   = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadError,  setUploadError]  = useState('')
  const [uploadFile,   setUploadFile]   = useState<File | null>(null)
  const [uploadFolder, setUploadFolder] = useState('')
  const [dragging,     setDragging]     = useState(false)

  // Delete file state
  const [deleteId,     setDeleteId]     = useState<number | null>(null)
  const [deleteError,  setDeleteError]  = useState('')

  // Move file state
  const [moveDoc,      setMoveDoc]      = useState<DocMeta | null>(null)
  const [moveTarget,   setMoveTarget]   = useState('')
  const [moveSaving,   setMoveSaving]   = useState(false)

  // Folder management state
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName,    setNewFolderName]    = useState('')
  const [folderSaving,     setFolderSaving]     = useState(false)
  const [folderError,      setFolderError]      = useState('')
  const [renameFolder,     setRenameFolder]     = useState<FolderRecord | null>(null)
  const [renameValue,      setRenameValue]      = useState('')
  const [renameSaving,     setRenameSaving]     = useState(false)
  const [renameError,      setRenameError]      = useState('')
  const [deleteFolder,     setDeleteFolder]     = useState<FolderRecord | null>(null)
  const [deleteFolderError, setDeleteFolderError] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isAdmin = currentUser.role === 'admin'

  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/documents?mode=folders', { credentials: 'include' })
    if (res.ok) setFolders(await res.json())
  }, [])

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const url = filterFolder
      ? `/api/documents?folder=${encodeURIComponent(filterFolder)}`
      : '/api/documents'
    const res = await fetch(url, { credentials: 'include' })
    if (res.ok) setDocs(await res.json())
    setLoading(false)
  }, [filterFolder])

  useEffect(() => { loadFolders() }, [loadFolders])
  useEffect(() => { loadDocs()    }, [loadDocs])

  const totalCount = folders.reduce((s, f) => s + f.count, 0)

  // ── Upload ──────────────────────────────────────────────────────────────────
  const openUpload = () => {
    setUploadFile(null)
    setUploadFolder(filterFolder || folders[0]?.name || '')
    setUploadError('')
    setShowUpload(true)
  }

  const handleFilePick = (files: FileList | null) => {
    if (files?.[0]) setUploadFile(files[0])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    handleFilePick(e.dataTransfer.files)
  }

  const doUpload = async () => {
    if (!uploadFile)   { setUploadError('Please select a file'); return }
    if (!uploadFolder) { setUploadError('Please choose a folder'); return }
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file',   uploadFile)
      fd.append('folder', uploadFolder)
      const res  = await fetch('/api/documents', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setShowUpload(false)
      await loadFolders()
      if (filterFolder === null || filterFolder === uploadFolder) {
        setDocs(d => [data.doc, ...d])
      } else {
        setFilterFolder(uploadFolder)
      }
    } catch (e: unknown) { setUploadError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  // ── Delete file ─────────────────────────────────────────────────────────────
  const doDeleteFile = async (id: number) => {
    setDeleteError('')
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) { setDeleteError('Delete failed'); return }
    setDocs(d => d.filter(x => x.id !== id))
    await loadFolders()
    setDeleteId(null)
  }

  // ── Move file ───────────────────────────────────────────────────────────────
  const doMove = async () => {
    if (!moveDoc || !moveTarget.trim()) return
    setMoveSaving(true)
    const res = await fetch(`/api/documents/${moveDoc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ folder: moveTarget.trim() }),
    })
    if (res.ok) {
      setDocs(d => d.map(x => x.id === moveDoc.id ? { ...x, folder: moveTarget.trim() } : x))
      await loadFolders()
      setMoveDoc(null)
    }
    setMoveSaving(false)
  }

  // ── Folder CRUD ──────────────────────────────────────────────────────────────
  const doCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { setFolderError('Enter a folder name'); return }
    setFolderSaving(true); setFolderError('')
    try {
      const res  = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'create-folder', name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setShowCreateFolder(false); setNewFolderName('')
      setFolders(f => [...f, data.folder].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e: unknown) { setFolderError(e instanceof Error ? e.message : 'Error') }
    finally { setFolderSaving(false) }
  }

  const doRenameFolder = async () => {
    if (!renameFolder || !renameValue.trim()) return
    setRenameSaving(true); setRenameError('')
    try {
      const res  = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'rename-folder', oldName: renameFolder.name, newName: renameValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      await loadFolders(); await loadDocs()
      if (filterFolder === renameFolder.name) setFilterFolder(renameValue.trim())
      setRenameFolder(null)
    } catch (e: unknown) { setRenameError(e instanceof Error ? e.message : 'Error') }
    finally { setRenameSaving(false) }
  }

  const doDeleteFolder = async (f: FolderRecord) => {
    setDeleteFolderError('')
    const res  = await fetch('/api/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'delete-folder', name: f.name }),
    })
    const data = await res.json()
    if (!res.ok) { setDeleteFolderError(data.error || 'Failed'); return }
    setFolders(fl => fl.filter(x => x.name !== f.name))
    if (filterFolder === f.name) setFilterFolder(null)
    setDeleteFolder(null)
  }

  const filtered = docs.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.uploader_name.toLowerCase().includes(search.toLowerCase()) ||
    d.folder.toLowerCase().includes(search.toLowerCase())
  )

  // ── Styles ──────────────────────────────────────────────────────────────────
  const navS: React.CSSProperties  = { background: '#1a3a2a', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, height: 50, flexShrink: 0 }
  const logoS: React.CSSProperties = { background: '#b5833a', color: 'white', fontWeight: 800, fontSize: 11, padding: '4px 9px', borderRadius: 4, letterSpacing: '1px' }
  const navA: React.CSSProperties  = { color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 12 }
  const navAct: React.CSSProperties = { color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 600, borderBottom: '2px solid #b5833a', paddingBottom: 2 }
  const divS: React.CSSProperties  = { width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }
  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const modalCard: React.CSSProperties = { background: 'white', borderRadius: 10, padding: 28, width: 480, maxWidth: '95vw', boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }
  const inp: React.CSSProperties = { border: '1px solid #d1d5db', borderRadius: 4, padding: '8px 11px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', background: '#f3f4f6' }}>
      <InactivityGuard />

      {/* NAV */}
      <div style={navS}>
        <span style={logoS}>PABARI</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>PABARI GROUP</span>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }}/>
        <a href="/" style={navA}>← Portal</a>
        <div style={divS}/>
        <a href="/documents" style={navAct}>Documents</a>
        {isAdmin && <><div style={divS}/><a href="/admin/users" style={navA}>Users</a></>}
        <div style={{ flex: 1 }}/>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{currentUser.name}</span>
        <a href="/api/auth/logout" style={{ ...navA, marginLeft: 6 }}>Sign out</a>
      </div>

      {/* PAGE HEADER + TABS */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 28px', flexShrink: 0 }}>
        <div style={{ paddingTop: 20, paddingBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#111', marginBottom: 2 }}>Document Library</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{totalCount} file(s) · {folders.length} folder(s)</div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 16 }}>
          {(['documents', 'folders'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 20px',
                fontSize: 13, fontWeight: 600, color: activeTab === tab ? '#1a3a2a' : '#9ca3af',
                borderBottom: activeTab === tab ? '2px solid #1a3a2a' : '2px solid transparent',
                textTransform: 'capitalize', letterSpacing: '0.2px',
              }}>
              {tab === 'documents' ? '📄 Documents' : '📁 Folders'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ DOCUMENTS TAB ════════════════════════════════════════════════════ */}
      {activeTab === 'documents' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Folder pills */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1, alignItems: 'center' }}>
              <button onClick={() => setFilterFolder(null)}
                style={{
                  border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  background: filterFolder === null ? '#1a3a2a' : '#f3f4f6',
                  color: filterFolder === null ? 'white' : '#374151',
                }}>
                All ({totalCount})
              </button>
              {folders.map(f => (
                <button key={f.name} onClick={() => setFilterFolder(f.name === filterFolder ? null : f.name)}
                  style={{
                    border: 'none', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: filterFolder === f.name ? '#1a3a2a' : '#f3f4f6',
                    color: filterFolder === f.name ? 'white' : '#374151',
                  }}>
                  {f.name} ({f.count})
                </button>
              ))}
              {folders.length === 0 && (
                <span style={{ fontSize: 12, color: '#9ca3af' }}>No folders yet — create one in the Folders tab</span>
              )}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '6px 12px', fontSize: 13, width: 180, outline: 'none', flexShrink: 0 }}/>
            <button onClick={openUpload} disabled={folders.length === 0}
              style={{ background: folders.length === 0 ? '#9ca3af' : '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: folders.length === 0 ? 'not-allowed' : 'pointer', flexShrink: 0, whiteSpace: 'nowrap' }}>
              + Upload
            </button>
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>
                  {search ? 'No files match your search' : folders.length === 0 ? 'Create a folder first, then upload files' : 'No files here yet'}
                </div>
                {!search && folders.length > 0 && (
                  <button onClick={openUpload} style={{ marginTop: 16, background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Upload your first file
                  </button>
                )}
                {folders.length === 0 && (
                  <button onClick={() => setActiveTab('folders')} style={{ marginTop: 16, background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Go to Folders →
                  </button>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                    {['File', 'Folder', 'Size', 'Uploaded By', 'Date', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '9px 20px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc, i) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '11px 20px', maxWidth: 300 }}>
                        <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#111' }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(doc.mime_type, doc.name)}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>{doc.name}</span>
                        </a>
                      </td>
                      <td style={{ padding: '11px 20px' }}>
                        <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          onClick={() => setFilterFolder(doc.folder)}>
                          📁 {doc.folder}
                        </span>
                      </td>
                      <td style={{ padding: '11px 20px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtSize(doc.size)}</td>
                      <td style={{ padding: '11px 20px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{doc.uploader_name || doc.uploaded_by}</td>
                      <td style={{ padding: '11px 20px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtDate(doc.created_at)}</td>
                      <td style={{ padding: '11px 20px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <a href={`/api/documents/${doc.id}?download=1`}
                            style={{ background: 'white', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 10px', fontSize: 11, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
                            ↓
                          </a>
                          <button onClick={() => { setMoveDoc(doc); setMoveTarget(doc.folder) }}
                            style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>
                            Move
                          </button>
                          <button onClick={() => { setDeleteId(doc.id); setDeleteError('') }}
                            style={{ background: 'white', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ═══ FOLDERS TAB ══════════════════════════════════════════════════════ */}
      {activeTab === 'folders' && (
        <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
            <div style={{ fontSize: 14, color: '#6b7280' }}>{folders.length} folder(s) total</div>
            <button onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setFolderError('') }}
              style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              + Create Folder
            </button>
          </div>

          {folders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No folders yet</div>
              <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>Create folders to organise your documents by category or department</div>
              <button onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setFolderError('') }}
                style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '10px 24px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                + Create your first folder
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {folders.map(f => (
                <div key={f.name} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                      📁
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                        {f.count} {f.count === 1 ? 'file' : 'files'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setActiveTab('documents'); setFilterFolder(f.name) }}
                      style={{ flex: 1, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 5, padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      View Files
                    </button>
                    <button onClick={() => { setRenameFolder(f); setRenameValue(f.name); setRenameError('') }}
                      style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 5, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
                      Rename
                    </button>
                    <button onClick={() => { setDeleteFolder(f); setDeleteFolderError('') }}
                      style={{ background: 'white', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: 5, padding: '6px 10px', fontSize: 11, cursor: 'pointer' }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ UPLOAD MODAL ════════════════════════════════════════════════════ */}
      {showUpload && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowUpload(false) }}>
          <div style={modalCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Upload Document</div>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? '#1a3a2a' : uploadFile ? '#86efac' : '#d1d5db'}`,
                borderRadius: 8, padding: '28px 20px', textAlign: 'center', cursor: 'pointer',
                background: dragging || uploadFile ? '#f0fdf4' : '#fafafa',
                marginBottom: 20, transition: 'all 0.15s',
              }}
            >
              {uploadFile ? (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>{fileIcon(uploadFile.type, uploadFile.name)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111' }}>{uploadFile.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{fmtSize(uploadFile.size)}</div>
                  <div style={{ fontSize: 11, color: '#1a3a2a', marginTop: 8, textDecoration: 'underline' }}>Click to change file</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Drag & drop a file here</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>or click to browse — max 20 MB</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => handleFilePick(e.target.files)} />

            {/* Folder picker */}
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Save to Folder</label>
              <select value={uploadFolder} onChange={e => setUploadFolder(e.target.value)}
                style={{ ...inp }}>
                {folders.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            </div>

            {uploadError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{uploadError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(false)}
                style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={doUpload} disabled={uploading || !uploadFile}
                style={{ background: uploading || !uploadFile ? '#9ca3af' : '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: uploading || !uploadFile ? 'not-allowed' : 'pointer' }}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE FILE CONFIRM ═════════════════════════════════════════════ */}
      {deleteId !== null && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteId(null) }}>
          <div style={{ ...modalCard, width: 360 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Delete File?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This will permanently delete the file and cannot be undone.</div>
            {deleteError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => doDeleteFile(deleteId)} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOVE FILE MODAL ═════════════════════════════════════════════════ */}
      {moveDoc && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setMoveDoc(null) }}>
          <div style={{ ...modalCard, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Move File</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{moveDoc.name}</div>
            <label style={lbl}>Move to Folder</label>
            <select value={moveTarget} onChange={e => setMoveTarget(e.target.value)} style={{ ...inp, marginBottom: 20 }}>
              {folders.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMoveDoc(null)} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={doMove} disabled={moveSaving} style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: moveSaving ? 0.7 : 1 }}>
                {moveSaving ? 'Moving…' : 'Move'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE FOLDER MODAL ═════════════════════════════════════════════ */}
      {showCreateFolder && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowCreateFolder(false) }}>
          <div style={{ ...modalCard, width: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Create Folder</div>
              <button onClick={() => setShowCreateFolder(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <label style={lbl}>Folder / Category Name</label>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreateFolder()}
              placeholder="e.g. Finance, Legal, HR, Contracts…"
              style={{ ...inp, marginBottom: 8 }}/>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>
              Examples: Finance · Legal · Human Resources · Group Contracts · KISCOL Ops · Board Minutes
            </div>
            {folderError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{folderError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateFolder(false)} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={doCreateFolder} disabled={folderSaving}
                style={{ background: folderSaving ? '#9ca3af' : '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: folderSaving ? 'not-allowed' : 'pointer' }}>
                {folderSaving ? 'Creating…' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RENAME FOLDER MODAL ═════════════════════════════════════════════ */}
      {renameFolder && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setRenameFolder(null) }}>
          <div style={{ ...modalCard, width: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Rename Folder</div>
            <label style={lbl}>New Name</label>
            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doRenameFolder()}
              style={{ ...inp, marginBottom: 8 }}/>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>
              All {renameFolder.count} file(s) in this folder will move to the new name automatically.
            </div>
            {renameError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{renameError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameFolder(null)} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={doRenameFolder} disabled={renameSaving}
                style={{ background: renameSaving ? '#9ca3af' : '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 22px', fontSize: 13, fontWeight: 600, cursor: renameSaving ? 'not-allowed' : 'pointer' }}>
                {renameSaving ? 'Renaming…' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE FOLDER CONFIRM ═══════════════════════════════════════════ */}
      {deleteFolder && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteFolder(null) }}>
          <div style={{ ...modalCard, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Delete Folder?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
              Delete folder <strong>"{deleteFolder.name}"</strong>?
            </div>
            {deleteFolder.count > 0 ? (
              <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 5, padding: '8px 12px', marginTop: 8, marginBottom: 16 }}>
                This folder has {deleteFolder.count} file(s). Move or delete all files before deleting the folder.
              </div>
            ) : (
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 16 }}>This folder is empty and can be deleted.</div>
            )}
            {deleteFolderError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{deleteFolderError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteFolder(null)} style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => doDeleteFolder(deleteFolder)} disabled={deleteFolder.count > 0}
                style={{ background: deleteFolder.count > 0 ? '#9ca3af' : '#dc2626', color: 'white', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: deleteFolder.count > 0 ? 'not-allowed' : 'pointer' }}>
                Delete Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <div style={{ background: '#1a3a2a', color: 'rgba(255,255,255,0.55)', fontSize: 10.5, padding: '5px 20px', display: 'flex', gap: 14, alignItems: 'center', flexShrink: 0 }}>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>PABARI GROUP</span>
        <span>·</span><span>Document Library</span>
        <span>·</span><span>{currentUser.name}</span>
      </div>
    </div>
  )
}
