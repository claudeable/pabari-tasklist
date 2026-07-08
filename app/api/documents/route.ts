import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { listDocuments, getFolders, saveDocument } from '@/lib/documents'

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
