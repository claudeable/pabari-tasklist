import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { saveTaskAttachment, listTaskAttachments } from '@/lib/taskAttachments'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const atts = await listTaskAttachments(params.id)
  return NextResponse.json(atts)
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData  = await req.formData()
  const file      = formData.get('file') as File | null
  const update_id = (formData.get('update_id') as string | null) || null

  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: 'Max 20 MB' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const att = await saveTaskAttachment({
    task_id:       params.id,
    update_id,
    name:          file.name,
    mime_type:     file.type || 'application/octet-stream',
    size:          file.size,
    buffer,
    uploaded_by:   user.email,
    uploader_name: user.name,
  })
  return NextResponse.json(att, { status: 201 })
}
