import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserByEmail } from '@/lib/users'
import { signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  const user = getUserByEmail(email)
  if (!user) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 })
  }

  const token = await signToken({
    id:    user.id,
    name:  user.name,
    email: user.email,
    role:  user.role,
  })

  const res = NextResponse.json({ ok: true, name: user.name, role: user.role })
  res.cookies.set('pabari-session', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path:     '/',
    maxAge:   60 * 60 * 24,
  })
  return res
}
