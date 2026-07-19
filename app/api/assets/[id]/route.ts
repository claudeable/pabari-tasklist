import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { updateAsset, deleteAsset } from '@/lib/assets'

async function getUser() {
  const token = cookies().get('pabari-session')?.value
  return token ? verifyToken(token) : null
}

function isEditor(user: Awaited<ReturnType<typeof getUser>>) {
  if (!user) return false
  return user.role === 'admin' || user.name.toLowerCase().split(' ')[0] === 'harshil'
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user)          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isEditor(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const asset = await updateAsset(parseInt(params.id), await req.json())
  if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ asset })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user)          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isEditor(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ok = await deleteAsset(parseInt(params.id))
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
