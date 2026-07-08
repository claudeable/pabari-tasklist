import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { listDocuments, getFolders, saveDocument, createFolder, renameFolder, deleteFolder } from '@/lib/documents'

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
  const folder = searchParams.get('folder') ?? undefined

  if (mode === 'folders') {
    return NextResponse.json(await getFolders())
  }

  return NextResponse.json(await listDocuments(folder))
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const contentType = req.headers.get('content-type') || ''

  // JSON body: folder management actions
  if (contentType.includes('application/json')) {
    const body   = await req.json()
    const action = body.action as string

    if (action === 'create-folder') {
      const name = (body.name as string | undefined)?.trim()
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      const folder = await createFolder(name)
      return NextResponse.json({ folder }, { status: 201 })
    }

    if (action === 'rename-folder') {
      const { oldName, newName } = body as { oldName: string; newName: string }
      if (!oldName || !newName) return NextResponse.json({ error: 'oldName and newName required' }, { status: 400 })
      await renameFolder(oldName.trim(), newName.trim())
      return NextResponse.json({ ok: true })
    }

    if (action === 'delete-folder') {
      const name = (body.name as string | undefined)?.trim()
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
      const result = await deleteFolder(name)
      if (!result.deleted) return NextResponse.json({ error: `Folder has ${result.fileCount} file(s). Move or delete them first.` }, { status: 409 })
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  // Multipart: file upload
  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const folder   = ((formData.get('folder') as string) || 'General').trim() || 'General'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 20 MB)' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const doc    = await saveDocument({
    name: file.name,
    folder,
    mime_type: file.type || 'application/octet-stream',
    size: file.size,
    buffer,
    uploaded_by:   user!.email,
    uploader_name: user!.name,
  })

  return NextResponse.json({ doc }, { status: 201 })
}
