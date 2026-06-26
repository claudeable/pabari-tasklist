import { NextRequest, NextResponse } from 'next/server'

const getSecret = () =>
  process.env.JWT_SECRET ?? 'pabari-erp-default-secret-change-in-production'

async function verifyHS256(token: string): Promise<boolean> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return false
    const [h, p, s] = parts

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )

    const sig = Uint8Array.from(
      atob(s.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    )

    const valid = await crypto.subtle.verify(
      'HMAC', key, sig,
      new TextEncoder().encode(`${h}.${p}`)
    )
    if (!valid) return false

    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')))
    if (payload.exp && payload.exp * 1000 < Date.now()) return false

    return true
  } catch {
    return false
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isProtected =
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/api/tasks') ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/api/reports')

  if (!isProtected) return NextResponse.next()

  const token = req.cookies.get('pabari-session')?.value
  if (!token) return NextResponse.redirect(new URL('/login', req.url))

  const ok = await verifyHS256(token)
  if (!ok) {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.set('pabari-session', '', { maxAge: 0, path: '/' })
    return res
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/tasks/:path*', '/api/tasks/:path*', '/dashboard/:path*', '/dashboard',
            '/reports/:path*', '/reports', '/api/reports/:path*'],
}
