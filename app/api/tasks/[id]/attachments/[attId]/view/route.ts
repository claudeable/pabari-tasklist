import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getTaskAttachmentData } from '@/lib/taskAttachments'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; attId: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const att = await getTaskAttachmentData(Number(params.attId))
  if (!att) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const buf = Buffer.isBuffer(att.data) ? att.data : Buffer.from(att.data)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type':        att.mime_type || 'application/octet-stream',
      'Content-Length':      String(buf.length),
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(att.name)}`,
      'Cache-Control':       'private, no-store',
    },
  })
}
