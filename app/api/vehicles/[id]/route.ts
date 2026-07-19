import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { updateVehicle, deleteVehicle } from '@/lib/assets'

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
  const vehicle = await updateVehicle(parseInt(params.id), await req.json())
  if (!vehicle) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ vehicle })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user)          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isEditor(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const ok = await deleteVehicle(parseInt(params.id))
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
