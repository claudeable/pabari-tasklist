import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const FINANCE_EMAILS = new Set([
  'hkotecha@kwale-group.com',
  'pmureithi@usm.co.ke',
  'yaynalem@usm.co.ke',
  'rkrishnan@usm.co.ke',
  'ateferi@kwale-group.com',
])

const PUBLIC = ['/login', '/api/auth/login']

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (PUBLIC.some(p => path.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get('fin-session')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    const { payload } = await jwtVerify(token, secret)
    const email = String((payload as Record<string, unknown>).email || '')
    if (!FINANCE_EMAILS.has(email.toLowerCase())) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
