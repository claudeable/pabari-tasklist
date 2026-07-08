'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SessionUser } from '@/types'
import InactivityGuard from './InactivityGuard'

interface DocMeta {
  id: number; name: string; folder: string; mime_type: string
  size: number; uploaded_by: string; uploader_name: string; created_at: string
}
interface FolderInfo { folder: string; count: number }
interface Props { currentUser: SessionUser }

function fmtSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`
  if (bytes < 1048576)    return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fileIcon(mime: string, name: string): string {
  if (mime.startsWith('image/'))                              return '🖼️'
  if (mime === 'application/pdf' || /\.pdf$/i.test(name))   return '📄'
  if (mime.includes('word')  || /\.(docx?|odt)$/i.test(name))    return '📝'
  if (mime.includes('sheet') || /\.(xlsx?|csv|ods)$/i.test(name)) return '📊'
  if (mime.includes('presentation') || /\.(pptx?|odp)$/i.test(name)) return '📈'
  if (mime.includes('zip') || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return '🗜️'
  if (mime.startsWith('text/') || /\.(txt|md|json|xml)$/i.test(name)) return '📃'
  return '📁'
}

export default function DocumentManager({ currentUser }: Props) {
  const [folders,       setFolders]       = useState<FolderInfo[]>([])
  const [docs,          setDocs]          = useState<DocMeta[]>([])
  const [activeFolder,  setActiveFolder]  = useState<string | null>(null) // null = all
  const [search,        setSearch]        = useState('')
  const [loading,       setLoading]       = useState(true)
  const [showUpload,    setShowUpload]    = useState(false)
  const [uploading,     setUploading]     = useState(false)
  const [uploadError,   setUploadError]   = useState('')
  const [uploadFile,    setUploadFile]    = useState<File | null>(null)
  const [uploadFolder,  setUploadFolder]  = useState('')
  const [newFolderMode, setNewFolderMode] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [dragging,      setDragging]      = useState(false)
  const [deleteId,      setDeleteId]      = useState<number | null>(null)
  const [deleteError,   setDeleteError]   = useState('')
  const [moveDoc,       setMoveDoc]       = useState<DocMeta | null>(null)
  const [moveFolder,    setMoveFolder]    = useState('')
  const [moveSaving,    setMoveSaving]    = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadFolders = useCallback(async () => {
    const res = await fetch('/api/documents?mode=folders', { credentials: 'include' })
    if (res.ok) setFolders(await res.json())
  }, [])

  const loadDocs = useCallback(async () => {
    setLoading(true)
    const url = activeFolder
      ? `/api/documents?folder=${encodeURIComponent(activeFolder)}`
      : '/api/documents'
    const res = await fetch(url, { credentials: 'include' })
    if (res.ok) setDocs(await res.json())
    setLoading(false)
  }, [activeFolder])

  useEffect(() => { loadFolders() }, [loadFolders])
  useEffect(() => { loadDocs() },    [loadDocs])

  const totalCount = folders.reduce((s, f) => s + f.count, 0)

  const openUpload = () => {
    setUploadFile(null); setUploadFolder(folders[0]?.folder || 'General')
    setNewFolderMode(false); setNewFolderName(''); setUploadError('')
    setShowUpload(true)
  }

  const handleFilePick = (files: FileList | null) => {
    if (!files || !files[0]) return
    setUploadFile(files[0])
    if (!uploadFolder && !newFolderMode) {
      setUploadFolder(folders[0]?.folder || 'General')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    handleFilePick(e.dataTransfer.files)
  }

  const doUpload = async () => {
    if (!uploadFile) { setUploadError('Please select a file'); return }
    const folder = newFolderMode ? newFolderName.trim() : uploadFolder
    if (!folder) { setUploadError('Please choose or create a folder'); return }

    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('folder', folder)
      const res = await fetch('/api/documents', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setShowUpload(false)
      await loadFolders()
      if (activeFolder === null || activeFolder === folder) {
        setDocs(d => [data.doc, ...d])
      }
      if (activeFolder !== null && activeFolder !== folder) {
        // switch to the newly uploaded folder
        setActiveFolder(folder)
      }
    } catch (e: unknown) { setUploadError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  const doDelete = async (id: number) => {
    setDeleteError('')
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE', credentials: 'include' })
    if (!res.ok) { setDeleteError('Delete failed'); return }
    setDocs(d => d.filter(x => x.id !== id))
    await loadFolders()
    setDeleteId(null)
  }

  const doMove = async () => {
    if (!moveDoc || !moveFolder.trim()) return
    setMoveSaving(true)
    // Re-upload with same file data isn't feasible; we'll expose a PATCH endpoint
    // For now, we handle move via PATCH to /api/documents/[id] with {folder}
    const res = await fetch(`/api/documents/${moveDoc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ folder: moveFolder.trim() }),
    })
    if (res.ok) {
      setDocs(d => d.map(x => x.id === moveDoc.id ? { ...x, folder: moveFolder.trim() } : x))
      await loadFolders()
      setMoveDoc(null)
    }
    setMoveSaving(false)
  }

  const filtered = docs.filter(d =>
    !search ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.uploader_name.toLowerCase().includes(search.toLowerCase())
  )

  // ── styles ──────────────────────────────────────────────────────────────────
  const nav: React.CSSProperties   = { background: '#1a3a2a', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, height: 50, flexShrink: 0 }
  const logo: React.CSSProperties  = { background: '#b5833a', color: 'white', fontWeight: 800, fontSize: 11, padding: '4px 9px', borderRadius: 4, letterSpacing: '1px' }
  const navA: React.CSSProperties  = { color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 12 }
  const navAct: React.CSSProperties = { color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 600, borderBottom: '2px solid #b5833a', paddingBottom: 2 }
  const divider: React.CSSProperties = { width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }

  const overlayBg: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  const card: React.CSSProperties = {
    background: 'white', borderRadius: 10, padding: 28, width: 480,
    maxWidth: '95vw', boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
  }

  const isAdmin   = currentUser.role === 'admin'
  const isHarshil = currentUser.role === 'director' && currentUser.department === 'Director'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'Inter,Arial,sans-serif', background: '#f3f4f6' }}>
      <InactivityGuard />

      {/* NAV */}
      <div style={nav}>
        <span style={logo}>PABARI</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>PABARI GROUP</span>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }}/>
        <a href="/"          style={navA}>← Portal</a>
        <div style={divider}/>
        <a href="/tasks"     style={navA}>Task Board</a>
        <a href="/dashboard" style={navA}>Dashboard</a>
        <a href="/reports"   style={navA}>Reports</a>
        <a href="/documents" style={navAct}>Documents</a>
        {isAdmin && <><div style={divider}/><a href="/admin/users" style={navA}>Users</a></>}
        <div style={{ flex: 1 }}/>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>{currentUser.name}</span>
        <a href="/api/auth/logout" style={{ ...navA, marginLeft: 6 }}>Sign out</a>
      </div>

      {/* BODY */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <div style={{ width: 220, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '18px 16px 10px', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.7px', textTransform: 'uppercase' }}>
            Folders
          </div>

          {/* All Files */}
          <button
            onClick={() => setActiveFolder(null)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
              background: activeFolder === null ? '#f0fdf4' : 'transparent',
              borderLeft: activeFolder === null ? '3px solid #1a3a2a' : '3px solid transparent',
              color: activeFolder === null ? '#1a3a2a' : '#374151',
              fontWeight: activeFolder === null ? 700 : 400, fontSize: 13,
            }}
          >
            <span>📂 All Files</span>
            <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', borderRadius: 10, padding: '1px 7px' }}>{totalCount}</span>
          </button>

          {folders.map(f => (
            <button
              key={f.folder}
              onClick={() => setActiveFolder(f.folder)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 16px', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
                background: activeFolder === f.folder ? '#f0fdf4' : 'transparent',
                borderLeft: activeFolder === f.folder ? '3px solid #1a3a2a' : '3px solid transparent',
                color: activeFolder === f.folder ? '#1a3a2a' : '#374151',
                fontWeight: activeFolder === f.folder ? 700 : 400, fontSize: 13,
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📁 {f.folder}</span>
              <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', borderRadius: 10, padding: '1px 7px', flexShrink: 0 }}>{f.count}</span>
            </button>
          ))}

          {folders.length === 0 && (
            <div style={{ padding: '12px 16px', fontSize: 12, color: '#9ca3af' }}>No folders yet. Upload a file to get started.</div>
          )}
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '16px 24px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: '#111' }}>
                {activeFolder ? `📁 ${activeFolder}` : '📂 All Files'}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                {activeFolder
                  ? `${(folders.find(f => f.folder === activeFolder)?.count ?? 0)} file(s)`
                  : `${totalCount} file(s) across ${folders.length} folder(s)`}
              </div>
            </div>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search files…"
              style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 12px', fontSize: 13, width: 220, outline: 'none' }}
            />
            <button onClick={openUpload}
              style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              + Upload
            </button>
          </div>

          {/* File list */}
          <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>
                  {search ? 'No files match your search' : 'No files here yet'}
                </div>
                {!search && (
                  <button onClick={openUpload} style={{ marginTop: 16, background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Upload your first file
                  </button>
                )}
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                    {['File', ...(activeFolder ? [] : ['Folder']), 'Size', 'Uploaded By', 'Date', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((doc, i) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '11px 16px', maxWidth: 320 }}>
                        <a
                          href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#111' }}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(doc.mime_type, doc.name)}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>
                            {doc.name}
                          </span>
                        </a>
                      </td>
                      {!activeFolder && (
                        <td style={{ padding: '11px 16px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', borderRadius: 4, padding: '2px 8px' }}>{doc.folder}</span>
                        </td>
                      )}
                      <td style={{ padding: '11px 16px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtSize(doc.size)}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{doc.uploader_name || doc.uploaded_by}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtDate(doc.created_at)}</td>
                      <td style={{ padding: '11px 16px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <a href={`/api/documents/${doc.id}?download=1`}
                            style={{ background: 'white', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                            ↓ Download
                          </a>
                          <button onClick={() => { setMoveDoc(doc); setMoveFolder(doc.folder) }}
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
      </div>

      {/* UPLOAD MODAL */}
      {showUpload && (
        <div style={overlayBg} onClick={e => { if (e.target === e.currentTarget) setShowUpload(false) }}>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#111' }}>Upload Document</div>
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
                borderRadius: 8, padding: '32px 20px', textAlign: 'center', cursor: 'pointer',
                background: dragging ? '#f0fdf4' : uploadFile ? '#f0fdf4' : '#fafafa',
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

            {/* Folder selector */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                Folder
              </label>
              {!newFolderMode ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={uploadFolder}
                    onChange={e => setUploadFolder(e.target.value)}
                    style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '7px 10px', fontSize: 13, flex: 1 }}
                  >
                    {folders.length === 0 && <option value="General">General</option>}
                    {folders.map(f => <option key={f.folder} value={f.folder}>{f.folder}</option>)}
                  </select>
                  <button
                    onClick={() => { setNewFolderMode(true); setNewFolderName('') }}
                    style={{ background: 'white', border: '1px solid #d1d5db', borderRadius: 4, padding: '7px 12px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    + New
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    placeholder="e.g. Contracts, Finance, Legal…"
                    onKeyDown={e => e.key === 'Enter' && setNewFolderMode(false)}
                    style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '7px 10px', fontSize: 13, flex: 1 }}
                  />
                  {folders.length > 0 && (
                    <button
                      onClick={() => { setNewFolderMode(false); setUploadFolder(folders[0].folder) }}
                      style={{ background: 'white', border: '1px solid #d1d5db', borderRadius: 4, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                      ✕
                    </button>
                  )}
                </div>
              )}
            </div>

            {uploadError && (
              <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>
                {uploadError}
              </div>
            )}

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

      {/* DELETE CONFIRM */}
      {deleteId !== null && (
        <div style={overlayBg} onClick={e => { if (e.target === e.currentTarget) setDeleteId(null) }}>
          <div style={{ ...card, width: 360 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10, color: '#111' }}>Delete File?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
              This will permanently delete the file. This action cannot be undone.
            </div>
            {deleteError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{deleteError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)}
                style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={() => doDelete(deleteId)}
                style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 5, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOVE FILE MODAL */}
      {moveDoc && (
        <div style={overlayBg} onClick={e => { if (e.target === e.currentTarget) setMoveDoc(null) }}>
          <div style={{ ...card, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, color: '#111' }}>Move File</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>{moveDoc.name}</div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
              Move to Folder
            </label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <select
                value={moveFolder} onChange={e => setMoveFolder(e.target.value)}
                style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '7px 10px', fontSize: 13, flex: 1 }}>
                {folders.map(f => <option key={f.folder} value={f.folder}>{f.folder}</option>)}
              </select>
              <input
                value={moveFolder} onChange={e => setMoveFolder(e.target.value)}
                placeholder="or type new folder"
                style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '7px 10px', fontSize: 13, flex: 1 }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMoveDoc(null)}
                style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '8px 16px', fontSize: 13, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={doMove} disabled={moveSaving}
                style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '8px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: moveSaving ? 0.7 : 1 }}>
                {moveSaving ? 'Moving…' : 'Move'}
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
