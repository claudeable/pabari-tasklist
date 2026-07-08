'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { SessionUser } from '@/types'
import InactivityGuard from './InactivityGuard'

interface DocMeta {
  id: number; name: string; folder_id: number | null; folder_path: string
  mime_type: string; size: number; uploaded_by: string; uploader_name: string; created_at: string
}
interface FolderRecord {
  id: number; name: string; parent_id: number | null; path: string
  count: number; children: number; created_at: string
}
interface Crumb { id: number; name: string }
interface Props { currentUser: SessionUser }

function fmtSize(n: number) {
  if (n < 1024)    return `${n} B`
  if (n < 1048576) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1048576).toFixed(1)} MB`
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fileIcon(mime: string, name: string) {
  if (mime.startsWith('image/'))                                    return '🖼️'
  if (mime === 'application/pdf' || /\.pdf$/i.test(name))         return '📄'
  if (mime.includes('word')  || /\.(docx?|odt)$/i.test(name))    return '📝'
  if (mime.includes('sheet') || /\.(xlsx?|csv|ods)$/i.test(name)) return '📊'
  if (mime.includes('presentation') || /\.(pptx?)$/i.test(name))  return '📈'
  if (mime.includes('zip')  || /\.(zip|rar|7z|tar|gz)$/i.test(name)) return '🗜️'
  if (mime.startsWith('text/') || /\.(txt|md|json|xml)$/i.test(name)) return '📃'
  return '📄'
}

export default function DocumentManager({ currentUser }: Props) {
  const [tab, setTab] = useState<'documents' | 'folders'>('folders')

  // ── Documents tab ──────────────────────────────────────────────────────────
  const [allDocs,     setAllDocs]     = useState<DocMeta[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docSearch,   setDocSearch]   = useState('')

  // ── Folders tab — navigation ───────────────────────────────────────────────
  const [crumbs,      setCrumbs]     = useState<Crumb[]>([])         // breadcrumb
  const [currentId,   setCurrentId]  = useState<number | null>(null) // null = root
  const [subFolders,  setSubFolders] = useState<FolderRecord[]>([])
  const [folderFiles, setFolderFiles] = useState<DocMeta[]>([])
  const [navLoading,  setNavLoading]  = useState(false)

  // ── All folders (for pickers) ──────────────────────────────────────────────
  const [allFolders,  setAllFolders]  = useState<FolderRecord[]>([])

  // ── Upload ─────────────────────────────────────────────────────────────────
  const [showUpload,   setShowUpload]   = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadFile,   setUploadFile]   = useState<File | null>(null)
  const [uploadFolderId, setUploadFolderId] = useState<number | null>(null)
  const [uploadError,  setUploadError]  = useState('')
  const [dragging,     setDragging]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Delete file ────────────────────────────────────────────────────────────
  const [delFileId,    setDelFileId]   = useState<number | null>(null)

  // ── Move file ──────────────────────────────────────────────────────────────
  const [moveDoc,      setMoveDoc]     = useState<DocMeta | null>(null)
  const [moveFolderId, setMoveFolderId] = useState<number | null>(null)
  const [moveSaving,   setMoveSaving]  = useState(false)

  // ── Folder management ──────────────────────────────────────────────────────
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [newFolderName,    setNewFolderName]    = useState('')
  const [folderSaving,     setFolderSaving]     = useState(false)
  const [folderError,      setFolderError]      = useState('')
  const [renameTarget,     setRenameTarget]     = useState<FolderRecord | null>(null)
  const [renameValue,      setRenameValue]      = useState('')
  const [renameSaving,     setRenameSaving]     = useState(false)
  const [renameError,      setRenameError]      = useState('')
  const [delFolderTarget,  setDelFolderTarget]  = useState<FolderRecord | null>(null)
  const [delFolderError,   setDelFolderError]   = useState('')

  const isAdmin = currentUser.role === 'admin'

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadAllFolders = useCallback(async () => {
    const res = await fetch('/api/documents?mode=all-folders', { credentials: 'include' })
    if (res.ok) setAllFolders(await res.json())
  }, [])

  const loadAllDocs = useCallback(async () => {
    setDocsLoading(true)
    const res = await fetch('/api/documents', { credentials: 'include' })
    if (res.ok) setAllDocs(await res.json())
    setDocsLoading(false)
  }, [])

  const loadCurrentFolder = useCallback(async (folderId: number | null) => {
    setNavLoading(true)
    const subRes  = folderId === null
      ? await fetch('/api/documents?mode=folders', { credentials: 'include' })
      : await fetch(`/api/documents?mode=folders&parentId=${folderId}`, { credentials: 'include' })
    if (subRes.ok) setSubFolders(await subRes.json())

    if (folderId !== null) {
      const filesRes = await fetch(`/api/documents?folderId=${folderId}`, { credentials: 'include' })
      if (filesRes.ok) setFolderFiles(await filesRes.json())
    } else {
      setFolderFiles([])
    }
    setNavLoading(false)
  }, [])

  useEffect(() => { loadAllFolders(); loadAllDocs(); loadCurrentFolder(null) }, [loadAllFolders, loadAllDocs, loadCurrentFolder])

  const totalFiles   = allDocs.length
  const totalFolders = allFolders.length

  // ── Navigation ─────────────────────────────────────────────────────────────
  const enterFolder = (f: FolderRecord) => {
    setCrumbs(c => [...c, { id: f.id, name: f.name }])
    setCurrentId(f.id)
    loadCurrentFolder(f.id)
  }

  const navToCrumb = (index: number) => {
    if (index < 0) {
      setCrumbs([]); setCurrentId(null); loadCurrentFolder(null)
    } else {
      const target = crumbs[index]
      setCrumbs(c => c.slice(0, index + 1))
      setCurrentId(target.id); loadCurrentFolder(target.id)
    }
  }

  // ── Upload ─────────────────────────────────────────────────────────────────
  const openUpload = (presetFolderId?: number) => {
    setUploadFile(null)
    setUploadFolderId(presetFolderId ?? currentId ?? allFolders[0]?.id ?? null)
    setUploadError(''); setShowUpload(true)
  }

  const doUpload = async () => {
    if (!uploadFile)     { setUploadError('Select a file'); return }
    if (!uploadFolderId) { setUploadError('Choose a folder'); return }
    setUploading(true); setUploadError('')
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      fd.append('folderId', String(uploadFolderId))
      const res  = await fetch('/api/documents', { method: 'POST', body: fd, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setShowUpload(false)
      await loadAllFolders(); await loadAllDocs()
      if (currentId === uploadFolderId) {
        setFolderFiles(f => [data.doc, ...f])
      }
      await loadCurrentFolder(currentId)
    } catch (e: unknown) { setUploadError(e instanceof Error ? e.message : 'Upload failed') }
    finally { setUploading(false) }
  }

  // ── Delete file ────────────────────────────────────────────────────────────
  const doDeleteFile = async (id: number) => {
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE', credentials: 'include' })
    if (res.ok) {
      setAllDocs(d => d.filter(x => x.id !== id))
      setFolderFiles(d => d.filter(x => x.id !== id))
      await loadAllFolders()
      setDelFileId(null)
    }
  }

  // ── Move file ──────────────────────────────────────────────────────────────
  const doMove = async () => {
    if (!moveDoc || !moveFolderId) return
    setMoveSaving(true)
    const res = await fetch(`/api/documents/${moveDoc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ folderId: moveFolderId }),
    })
    if (res.ok) {
      const targetFolder = allFolders.find(f => f.id === moveFolderId)
      const newPath = targetFolder?.path || ''
      setAllDocs(d => d.map(x => x.id === moveDoc.id ? { ...x, folder_id: moveFolderId, folder_path: newPath } : x))
      setFolderFiles(d => d.filter(x => x.id !== moveDoc.id))
      await loadAllFolders(); await loadCurrentFolder(currentId)
      setMoveDoc(null)
    }
    setMoveSaving(false)
  }

  // ── Folder CRUD ────────────────────────────────────────────────────────────
  const doCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) { setFolderError('Enter a name'); return }
    setFolderSaving(true); setFolderError('')
    try {
      const res  = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'create-folder', name, parentId: currentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setShowCreateFolder(false); setNewFolderName('')
      await loadAllFolders()
      setSubFolders(f => [...f, data.folder].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (e: unknown) { setFolderError(e instanceof Error ? e.message : 'Error') }
    finally { setFolderSaving(false) }
  }

  const doRenameFolder = async () => {
    if (!renameTarget || !renameValue.trim()) return
    setRenameSaving(true); setRenameError('')
    try {
      const res  = await fetch('/api/documents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ action: 'rename-folder', id: renameTarget.id, newName: renameValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      await loadAllFolders(); await loadCurrentFolder(currentId); await loadAllDocs()
      setRenameTarget(null)
    } catch (e: unknown) { setRenameError(e instanceof Error ? e.message : 'Error') }
    finally { setRenameSaving(false) }
  }

  const doDeleteFolder = async (f: FolderRecord) => {
    setDelFolderError('')
    const res  = await fetch('/api/documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ action: 'delete-folder', id: f.id }),
    })
    const data = await res.json()
    if (!res.ok) { setDelFolderError(data.error || 'Failed'); return }
    await loadAllFolders()
    setSubFolders(fl => fl.filter(x => x.id !== f.id))
    setDelFolderTarget(null)
  }

  const filteredDocs = allDocs.filter(d =>
    !docSearch ||
    d.name.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.folder_path.toLowerCase().includes(docSearch.toLowerCase()) ||
    d.uploader_name.toLowerCase().includes(docSearch.toLowerCase())
  )

  // ── Styles ─────────────────────────────────────────────────────────────────
  const navS: React.CSSProperties   = { background: '#1a3a2a', padding: '0 18px', display: 'flex', alignItems: 'center', gap: 12, height: 50, flexShrink: 0 }
  const logoS: React.CSSProperties  = { background: '#b5833a', color: 'white', fontWeight: 800, fontSize: 11, padding: '4px 9px', borderRadius: 4, letterSpacing: '1px' }
  const navA: React.CSSProperties   = { color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 12 }
  const navAct: React.CSSProperties = { color: 'white', textDecoration: 'none', fontSize: 12, fontWeight: 600, borderBottom: '2px solid #b5833a', paddingBottom: 2 }
  const divS: React.CSSProperties   = { width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }
  const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }
  const modal: React.CSSProperties  = { background: 'white', borderRadius: 10, padding: 28, width: 460, maxWidth: '95vw', boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }
  const inp: React.CSSProperties    = { border: '1px solid #d1d5db', borderRadius: 4, padding: '8px 11px', fontSize: 13, width: '100%', outline: 'none', boxSizing: 'border-box' }
  const lbl: React.CSSProperties    = { display: 'block', fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 5 }
  const btnPrimary = (disabled = false): React.CSSProperties => ({
    background: disabled ? '#9ca3af' : '#1a3a2a', color: 'white', border: 'none',
    borderRadius: 5, padding: '9px 22px', fontSize: 13, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
  })
  const btnGhost: React.CSSProperties = { border: '1px solid #d1d5db', background: 'white', borderRadius: 5, padding: '9px 18px', fontSize: 13, cursor: 'pointer' }

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
        <div style={{ paddingTop: 18, paddingBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 20, color: '#111' }}>Document Library</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{totalFiles} file(s) · {totalFolders} folder(s)</div>
        </div>
        <div style={{ display: 'flex', gap: 0, marginTop: 14 }}>
          {(['folders', 'documents'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 22px',
                fontSize: 13, fontWeight: 600,
                color: tab === t ? '#1a3a2a' : '#9ca3af',
                borderBottom: tab === t ? '2px solid #1a3a2a' : '2px solid transparent',
              }}>
              {t === 'folders' ? '📁 Folders' : '📄 Documents'}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ FOLDERS TAB ══════════════════════════════════════════════════════ */}
      {tab === 'folders' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Breadcrumb + toolbar */}
          <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, flexWrap: 'wrap' }}>
              <button onClick={() => navToCrumb(-1)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: currentId === null ? '#1a3a2a' : '#6b7280', fontSize: 13, fontWeight: currentId === null ? 700 : 400, padding: '2px 4px' }}>
                📁 All Folders
              </button>
              {crumbs.map((c, i) => (
                <span key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#d1d5db', fontSize: 12 }}>›</span>
                  <button onClick={() => navToCrumb(i)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: i === crumbs.length - 1 ? '#1a3a2a' : '#6b7280', fontSize: 13, fontWeight: i === crumbs.length - 1 ? 700 : 400, padding: '2px 4px' }}>
                    {c.name}
                  </button>
                </span>
              ))}
            </div>
            <button onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setFolderError('') }}
              style={{ ...btnPrimary(), whiteSpace: 'nowrap', padding: '7px 16px', fontSize: 12 }}>
              + {currentId ? 'New Subfolder' : 'New Folder'}
            </button>
            {currentId !== null && (
              <button onClick={() => openUpload(currentId)}
                style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 5, padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                ↑ Upload Here
              </button>
            )}
          </div>

          {/* Content area */}
          <div style={{ flex: 1, overflow: 'auto', padding: 28 }}>
            {navLoading ? (
              <div style={{ color: '#9ca3af', fontSize: 14, padding: 20 }}>Loading…</div>
            ) : (
              <>
                {/* Subfolders grid */}
                {subFolders.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    {currentId !== null && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12 }}>
                        Subfolders
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
                      {subFolders.map(f => (
                        <div key={f.id}
                          style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, cursor: 'pointer', transition: 'box-shadow 0.15s' }}
                          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)')}
                          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                        >
                          {/* Click icon/name area to navigate in */}
                          <div onClick={() => enterFolder(f)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                              📁
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.name}>{f.name}</div>
                              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                                {f.count} file{f.count !== 1 ? 's' : ''}
                                {f.children > 0 ? ` · ${f.children} subfolder${f.children !== 1 ? 's' : ''}` : ''}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button onClick={() => enterFolder(f)}
                              style={{ flex: 1, background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac', borderRadius: 5, padding: '5px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              Open →
                            </button>
                            <button onClick={() => { setRenameTarget(f); setRenameValue(f.name); setRenameError('') }}
                              style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 5, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>
                              ✏️
                            </button>
                            <button onClick={() => { setDelFolderTarget(f); setDelFolderError('') }}
                              style={{ background: 'white', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: 5, padding: '5px 8px', fontSize: 11, cursor: 'pointer' }}>
                              🗑
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Files in current folder (only when inside a folder) */}
                {currentId !== null && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>Files in this folder ({folderFiles.length})</span>
                      <button onClick={() => openUpload(currentId)}
                        style={{ background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                        + Upload
                      </button>
                    </div>
                    {folderFiles.length === 0 ? (
                      <div style={{ background: 'white', border: '1px dashed #d1d5db', borderRadius: 8, padding: '32px 20px', textAlign: 'center' }}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
                        <div style={{ fontSize: 13, color: '#9ca3af' }}>No files in this folder yet</div>
                        <button onClick={() => openUpload(currentId)}
                          style={{ marginTop: 12, background: '#1a3a2a', color: 'white', border: 'none', borderRadius: 5, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                          Upload a file here
                        </button>
                      </div>
                    ) : (
                      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
                        {folderFiles.map((doc, i) => (
                          <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < folderFiles.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(doc.mime_type, doc.name)}</span>
                            <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer"
                              style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#111', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>
                              {doc.name}
                            </a>
                            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtSize(doc.size)}</span>
                            <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0 }}>{fmtDate(doc.created_at)}</span>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <a href={`/api/documents/${doc.id}?download=1`}
                                style={{ background: 'white', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 9px', fontSize: 11, textDecoration: 'none' }}>↓</a>
                              <button onClick={() => { setMoveDoc(doc); setMoveFolderId(doc.folder_id) }}
                                style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '3px 9px', fontSize: 11, cursor: 'pointer' }}>Move</button>
                              <button onClick={() => setDelFileId(doc.id)}
                                style={{ background: 'white', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: 4, padding: '3px 9px', fontSize: 11, cursor: 'pointer' }}>Delete</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Root level — no folder selected yet */}
                {currentId === null && subFolders.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No folders yet</div>
                    <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>Create folders like Finance, Legal, HR to organise your documents</div>
                    <button onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setFolderError('') }}
                      style={btnPrimary()}>
                      + Create your first folder
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ═══ DOCUMENTS TAB ════════════════════════════════════════════════════ */}
      {tab === 'documents' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 28px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="Search by file name, folder or uploader…"
              style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '7px 12px', fontSize: 13, flex: 1, outline: 'none', maxWidth: 380 }}/>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{filteredDocs.length} of {allDocs.length}</span>
            <button onClick={() => openUpload()}
              style={{ ...btnPrimary(allFolders.length === 0), whiteSpace: 'nowrap' }}>
              + Upload
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            {docsLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
            ) : filteredDocs.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
                <div style={{ fontSize: 14, color: '#6b7280' }}>
                  {docSearch ? 'No files match your search' : 'No documents yet — upload your first file'}
                </div>
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
                  {filteredDocs.map((doc, i) => (
                    <tr key={doc.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '11px 20px', maxWidth: 280 }}>
                        <a href={`/api/documents/${doc.id}`} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: '#111' }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{fileIcon(doc.mime_type, doc.name)}</span>
                          <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={doc.name}>{doc.name}</span>
                        </a>
                      </td>
                      <td style={{ padding: '11px 20px' }}>
                        <span
                          onClick={() => {
                            // Navigate to that folder in Folders tab
                            const f = allFolders.find(x => x.id === doc.folder_id)
                            if (!f) return
                            // Build crumb trail from path
                            const segments = f.path.split('/')
                            const allF = allFolders
                            const newCrumbs: Crumb[] = []
                            let searchPath = ''
                            for (let s = 0; s < segments.length; s++) {
                              searchPath = s === 0 ? segments[0] : `${searchPath}/${segments[s]}`
                              const found = allF.find(x => x.path === searchPath)
                              if (found) newCrumbs.push({ id: found.id, name: found.name })
                            }
                            setCrumbs(newCrumbs)
                            setCurrentId(f.id)
                            loadCurrentFolder(f.id)
                            setTab('folders')
                          }}
                          style={{ fontSize: 11, background: '#f3f4f6', color: '#374151', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                          📁 {doc.folder_path || '—'}
                        </span>
                      </td>
                      <td style={{ padding: '11px 20px', fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtSize(doc.size)}</td>
                      <td style={{ padding: '11px 20px', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>{doc.uploader_name || doc.uploaded_by}</td>
                      <td style={{ padding: '11px 20px', fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtDate(doc.created_at)}</td>
                      <td style={{ padding: '11px 20px' }}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <a href={`/api/documents/${doc.id}?download=1`}
                            style={{ background: 'white', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 4, padding: '3px 10px', fontSize: 11, textDecoration: 'none', whiteSpace: 'nowrap' }}>↓</a>
                          <button onClick={() => { setMoveDoc(doc); setMoveFolderId(doc.folder_id) }}
                            style={{ background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>Move</button>
                          <button onClick={() => setDelFileId(doc.id)}
                            style={{ background: 'white', color: '#dc2626', border: '1px solid #fee2e2', borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}>Delete</button>
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

      {/* ═══ UPLOAD MODAL ═════════════════════════════════════════════════════ */}
      {showUpload && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowUpload(false) }}>
          <div style={modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>Upload Document</div>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) setUploadFile(e.dataTransfer.files[0]) }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragging ? '#1a3a2a' : uploadFile ? '#86efac' : '#d1d5db'}`, borderRadius: 8, padding: '26px 20px', textAlign: 'center', cursor: 'pointer', background: dragging || uploadFile ? '#f0fdf4' : '#fafafa', marginBottom: 20 }}>
              {uploadFile ? (
                <>
                  <div style={{ fontSize: 26, marginBottom: 5 }}>{fileIcon(uploadFile.type, uploadFile.name)}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{uploadFile.name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{fmtSize(uploadFile.size)}</div>
                  <div style={{ fontSize: 11, color: '#1a3a2a', marginTop: 6, textDecoration: 'underline' }}>Click to change</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 30, marginBottom: 6 }}>📁</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Drag & drop a file here</div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>or click to browse — max 20 MB</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && setUploadFile(e.target.files[0])} />
            <div style={{ marginBottom: 18 }}>
              <label style={lbl}>Save to Folder</label>
              <select value={uploadFolderId ?? ''} onChange={e => setUploadFolderId(Number(e.target.value))}
                style={{ ...inp }}>
                <option value="">— Select a folder —</option>
                {allFolders.map(f => (
                  <option key={f.id} value={f.id}>{f.path}</option>
                ))}
              </select>
            </div>
            {uploadError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{uploadError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUpload(false)} style={btnGhost}>Cancel</button>
              <button onClick={doUpload} disabled={uploading || !uploadFile} style={btnPrimary(uploading || !uploadFile)}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ CREATE / RENAME FOLDER MODAL ════════════════════════════════════ */}
      {showCreateFolder && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowCreateFolder(false) }}>
          <div style={{ ...modal, width: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>
                {currentId ? 'Create Subfolder' : 'Create Folder'}
              </div>
              <button onClick={() => setShowCreateFolder(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>
            </div>
            {currentId !== null && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, background: '#f9fafb', borderRadius: 5, padding: '6px 10px' }}>
                Creating inside: <strong>{crumbs[crumbs.length - 1]?.name}</strong>
              </div>
            )}
            <label style={lbl}>Folder Name</label>
            <input autoFocus value={newFolderName} onChange={e => setNewFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doCreateFolder()}
              placeholder={currentId ? 'e.g. KISCOL, USM, 2024, 2025…' : 'e.g. Finance, Legal, HR, Contracts…'}
              style={{ ...inp, marginBottom: 6 }}/>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>
              {currentId ? `Will be created inside "${crumbs[crumbs.length - 1]?.name}"` : 'Top-level category. You can add subfolders inside it.'}
            </div>
            {folderError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{folderError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateFolder(false)} style={btnGhost}>Cancel</button>
              <button onClick={doCreateFolder} disabled={folderSaving} style={btnPrimary(folderSaving)}>
                {folderSaving ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setRenameTarget(null) }}>
          <div style={{ ...modal, width: 400 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Rename Folder</div>
            <label style={lbl}>New Name</label>
            <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && doRenameFolder()}
              style={{ ...inp, marginBottom: 6 }}/>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 16 }}>
              {renameTarget.count > 0 || renameTarget.children > 0
                ? `All files and subfolders inside will be updated automatically.`
                : 'This folder is empty.'}
            </div>
            {renameError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 12, background: '#fef2f2', borderRadius: 4, padding: '6px 10px' }}>{renameError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRenameTarget(null)} style={btnGhost}>Cancel</button>
              <button onClick={doRenameFolder} disabled={renameSaving} style={btnPrimary(renameSaving)}>
                {renameSaving ? 'Renaming…' : 'Rename'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE FOLDER ════════════════════════════════════════════════════ */}
      {delFolderTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDelFolderTarget(null) }}>
          <div style={{ ...modal, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Delete Folder?</div>
            {(delFolderTarget.count > 0 || delFolderTarget.children > 0) ? (
              <div style={{ fontSize: 12, color: '#dc2626', background: '#fef2f2', borderRadius: 5, padding: '8px 12px', marginBottom: 16 }}>
                {delFolderTarget.count > 0 && <div>This folder has {delFolderTarget.count} file(s).</div>}
                {delFolderTarget.children > 0 && <div>This folder has {delFolderTarget.children} subfolder(s).</div>}
                <div style={{ marginTop: 4 }}>Move or delete all contents first.</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                Delete <strong>"{delFolderTarget.name}"</strong>? This folder is empty.
              </div>
            )}
            {delFolderError && <div style={{ color: '#dc2626', fontSize: 12, marginBottom: 10 }}>{delFolderError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDelFolderTarget(null)} style={btnGhost}>Cancel</button>
              <button onClick={() => doDeleteFolder(delFolderTarget)}
                disabled={delFolderTarget.count > 0 || delFolderTarget.children > 0}
                style={{ ...btnPrimary(delFolderTarget.count > 0 || delFolderTarget.children > 0), background: delFolderTarget.count > 0 || delFolderTarget.children > 0 ? '#9ca3af' : '#dc2626' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ DELETE FILE CONFIRM ══════════════════════════════════════════════ */}
      {delFileId !== null && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDelFileId(null) }}>
          <div style={{ ...modal, width: 360 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Delete File?</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>This will permanently delete the file.</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDelFileId(null)} style={btnGhost}>Cancel</button>
              <button onClick={() => doDeleteFile(delFileId)} style={{ ...btnPrimary(), background: '#dc2626' }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOVE FILE MODAL ══════════════════════════════════════════════════ */}
      {moveDoc && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setMoveDoc(null) }}>
          <div style={{ ...modal, width: 380 }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Move File</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{moveDoc.name}</div>
            <label style={lbl}>Move to</label>
            <select value={moveFolderId ?? ''} onChange={e => setMoveFolderId(Number(e.target.value))}
              style={{ ...inp, marginBottom: 20 }}>
              <option value="">— Select folder —</option>
              {allFolders.map(f => <option key={f.id} value={f.id}>{f.path}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setMoveDoc(null)} style={btnGhost}>Cancel</button>
              <button onClick={doMove} disabled={moveSaving} style={btnPrimary(moveSaving)}>
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
