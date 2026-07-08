import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { listDocuments, getAllFolders, getFolders, saveDocument, createFolder, renameFolder, deleteFolder } from '@/lib/documents'

function canAccess(user: { role: string; department: string } | null): boolean {
  if (!user) return false
  return user.role === 'admin' ||
    (user.role === 'director' && user.department === 'Director')
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const mode      = searchParams.get('mode')
  const parentId  = searchParams.get('parentId')
  const folderIdQ = searchParams.get('folderId')

  // Folder listing modes
  if (mode === 'all-folders') {
    return NextResponse.json(await getAllFolders())
  }
  if (mode === 'folders') {
    const pid = parentId ? Number(parentId) : null
    return NextResponse.json(await getFolders(pid))
  }

  // Document listing
  const folderId = folderIdQ !== null ? Number(folderIdQ) : undefined
  return NextResponse.json(await listDocuments(folderId))
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contentType = req.headers.get('content-type') || ''

  // ── JSON: folder management actions ──────────────────────────────────────
  if (contentType.includes('application/json')) {
    const body   = await req.json()
    const action = body.action as string

    if (action === 'create-folder') {
      const name     = (body.name as string | undefined)?.trim()
      const parentId = body.parentId != null ? Number(body.parentId) : null
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      try {
        const folder = await createFolder(name, parentId)
        return NextResponse.json({ folder }, { status: 201 })
      } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 })
      }
    }

    if (action === 'rename-folder') {
      const { id, newName } = body as { id: number; newName: string }
      if (!id || !newName) return NextResponse.json({ error: 'id and newName required' }, { status: 400 })
      try {
        await renameFolder(Number(id), newName.trim())
        return NextResponse.json({ ok: true })
      } catch (e: unknown) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 })
      }
    }

    if (action === 'delete-folder') {
      const id = body.id != null ? Number(body.id) : null
      if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
      const result = await deleteFolder(id)
      if (!result.deleted) {
        const reason = result.fileCount > 0
          ? `Folder has ${result.fileCount} file(s).`
          : `Folder has ${result.childCount} subfolder(s).`
        return NextResponse.json({ error: `${reason} Move or delete them first.` }, { status: 409 })
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // ── Multipart: file upload ────────────────────────────────────────────────
  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const folderIdStr = formData.get('folderId') as string | null

  if (!file)        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!folderIdStr) return NextResponse.json({ error: 'folderId required' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const doc = await saveDocument({
      name: file.name,
      folder_id:     Number(folderIdStr),
      mime_type:     file.type || 'application/octet-stream',
      size:          file.size,
      buffer,
      uploaded_by:   user!.email,
      uploader_name: user!.name,
    })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 400 })
  }
}
