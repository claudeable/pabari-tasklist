import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { verifyToken } from '@/lib/auth'
import { updateUser, resetUserPassword, deleteUser } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  if (body.action === 'reset-password') {
    const hash = await bcrypt.hash('changeme123', 10)
    await resetUserPassword(params.id, hash)
    return NextResponse.json({ ok: true })
  }

  const updated = await updateUser(params.id, {
    name:       body.name,
    email:      body.email,
    role:       body.role,
    department: body.department,
    reports_to: body.reports_to,
    companies:  Array.isArray(body.companies) ? body.companies : undefined,
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Prevent deleting yourself
  if (params.id === user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const ok = await deleteUser(params.id)
  return NextResponse.json({ ok })
}
