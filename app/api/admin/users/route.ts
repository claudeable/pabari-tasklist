import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { verifyToken } from '@/lib/auth'
import { getUsers, createUser } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const users = await getUsers()
  return NextResponse.json(users.map(u => ({
    id: u.id, name: u.name, email: u.email,
    role: u.role, department: u.department, reports_to: u.reports_to,
    created_at: u.created_at,
  })))
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { name, email, role, department, reports_to } = body

  if (!name || !email || !role) {
    return NextResponse.json({ error: 'Name, email and role are required' }, { status: 400 })
  }

  const hash    = await bcrypt.hash('changeme123', 10)
  const created = await createUser({ name, email, role, department: department || '', reports_to: reports_to || '', password_hash: hash })

  const { password_hash: _, ...safe } = created
  return NextResponse.json(safe, { status: 201 })
}
