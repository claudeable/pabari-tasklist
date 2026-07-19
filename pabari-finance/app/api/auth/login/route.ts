import { NextRequest, NextResponse } from 'next/server'
import { loginUser, signToken } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const user = await loginUser(email.trim().toLowerCase(), password)
  if (!user) return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })

  const token = await signToken(user)
  const res = NextResponse.json({ ok: true })
  res.cookies.set('fin-session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24,
    path: '/',
  })
  return res
}
