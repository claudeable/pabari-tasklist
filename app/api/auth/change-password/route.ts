import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { verifyToken } from '@/lib/auth'
import { getUserByEmail, updateUserPassword } from '@/lib/users'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  if (!token) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 })

  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Invalid session.' }, { status: 401 })

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Both fields are required.' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 })
  }

  const user = getUserByEmail(session.email)
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 401 })

  const newHash = await bcrypt.hash(newPassword, 10)
  const ok = updateUserPassword(user.id, newHash)
  if (!ok) return NextResponse.json({ error: 'Failed to save new password.' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
