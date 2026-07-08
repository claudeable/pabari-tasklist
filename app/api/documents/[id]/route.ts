import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDocumentFile, deleteDocument, moveDocument } from '@/lib/documents'

function canAccess(user: { role: string; department: string } | null): boolean {
  if (!user) return false
  return user.role === 'admin' ||
    (user.role === 'director' && user.department === 'Director')
}

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const doc = await getDocumentFile(Number(params.id))
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const forceDownload = req.nextUrl.searchParams.get('download') === '1'
  const disposition   = forceDownload
    ? `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}`
    : `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`

  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      'Content-Type':        doc.mime_type || 'application/octet-stream',
      'Content-Disposition': disposition,
    },
  })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body     = await req.json()
  const folderId = body.folderId != null ? Number(body.folderId) : null
  if (!folderId) return NextResponse.json({ error: 'folderId is required' }, { status: 400 })

  const ok = await moveDocument(Number(params.id), folderId)
  if (!ok) return NextResponse.json({ error: 'Not found or folder not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ok = await deleteDocument(Number(params.id))
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
