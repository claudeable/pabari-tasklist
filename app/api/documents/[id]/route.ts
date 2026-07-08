import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getDocumentFile, deleteDocument, moveDocument, updateDocumentExpiry } from '@/lib/documents'
import { logActivity } from '@/lib/activityLog'

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

  if (forceDownload) {
    logActivity(user!.email, user!.name, 'doc_downloaded', `Downloaded "${doc.name}"`).catch(() => {})
  }

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

  const body = await req.json()

  if ('folder' in body) {
    const folder = (body.folder as string | undefined)?.trim()
    if (!folder) return NextResponse.json({ error: 'folder required' }, { status: 400 })
    const ok = await moveDocument(Number(params.id), folder)
    if (ok) logActivity(user!.email, user!.name, 'doc_moved', `Moved document #${params.id} → "${folder}"`).catch(() => {})
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if ('expiry_date' in body) {
    const ok = await updateDocumentExpiry(Number(params.id), body.expiry_date ?? null)
    if (ok) {
      const detail = body.expiry_date
        ? `Set expiry on document #${params.id} → ${body.expiry_date}`
        : `Removed expiry from document #${params.id}`
      logActivity(user!.email, user!.name, 'doc_expiry_updated', detail).catch(() => {})
    }
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const doc = await getDocumentFile(Number(params.id))
  const ok  = await deleteDocument(Number(params.id))
  if (ok && doc) logActivity(user!.email, user!.name, 'doc_deleted', `Deleted "${doc.name}"`).catch(() => {})
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 })
}
