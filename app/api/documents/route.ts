import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import {
  listDocuments, getFolderSummaries, getAllFolderNames,
  getAllExpiringDocuments, getExpiringCount,
  saveDocument, createFolder, renameFolder, deleteFolder,
} from '@/lib/documents'

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
  const mode   = searchParams.get('mode')
  const entity = searchParams.get('entity') || 'Group'
  const folder = searchParams.get('folder') || undefined

  if (mode === 'folder-summaries') {
    return NextResponse.json(await getFolderSummaries(entity))
  }
  if (mode === 'folder-names') {
    return NextResponse.json(await getAllFolderNames())
  }
  if (mode === 'expiring') {
    return NextResponse.json(await getAllExpiringDocuments())
  }
  if (mode === 'expiring-count') {
    return NextResponse.json({ count: await getExpiringCount() })
  }

  return NextResponse.json(await listDocuments(entity, folder))
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contentType = req.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const body   = await req.json()
    const action = String(body.action || '')

    if (action === 'create-folder') {
      const name = (body.name as string | undefined)?.trim()
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      try { await createFolder(name); return NextResponse.json({ ok: true, name }, { status: 201 }) }
      catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 }) }
    }

    if (action === 'rename-folder') {
      const { oldName, newName } = body as { oldName: string; newName: string }
      if (!oldName || !newName) return NextResponse.json({ error: 'oldName and newName required' }, { status: 400 })
      try { await renameFolder(oldName.trim(), newName.trim()); return NextResponse.json({ ok: true }) }
      catch (e: unknown) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 400 }) }
    }

    if (action === 'delete-folder') {
      const name = (body.name as string | undefined)?.trim()
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      const result = await deleteFolder(name)
      if (!result.deleted) return NextResponse.json({ error: `Folder has ${result.count} file(s). Move or delete them first.` }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // File upload (multipart)
  const formData     = await req.formData()
  const file         = formData.get('file') as File | null
  const entity       = (formData.get('entity') as string | null) || 'Group'
  const folder       = ((formData.get('folder') as string | null) || 'General').trim()
  const doc_type     = ((formData.get('doc_type') as string | null) || '').trim()
  const expiry_date  = (formData.get('expiry_date') as string | null) || null
  const reference_no = ((formData.get('reference_no') as string | null) || '').trim() || null
  const description  = ((formData.get('description') as string | null) || '').trim()
  const yearRaw      = formData.get('year') as string | null
  const year         = yearRaw ? parseInt(yearRaw) : new Date().getFullYear()

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  try {
    const doc = await saveDocument({
      name: file.name, entity, folder, doc_type,
      expiry_date: expiry_date || null,
      mime_type:     file.type || 'application/octet-stream',
      size:          file.size, buffer,
      uploaded_by:   user!.email,
      uploader_name: user!.name,
      reference_no, description, year,
    })
    return NextResponse.json({ doc }, { status: 201 })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload failed' }, { status: 400 })
  }
}
