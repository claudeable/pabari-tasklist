import { NextRequest, NextResponse } from 'next/server'
import { validateViewToken } from '@/lib/docTokens'
import { getDocumentFile } from '@/lib/documents'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const docId = validateViewToken(params.token)
  if (!docId) return NextResponse.json({ error: 'Invalid or expired token' }, { status: 403 })

  const doc = await getDocumentFile(docId)
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buf = Buffer.isBuffer(doc.data) ? doc.data : Buffer.from(doc.data)

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':   doc.mime_type || 'application/octet-stream',
      'Content-Length': String(buf.length),
      // Must be inline so Office Online viewer fetches and renders it (not triggers download)
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
