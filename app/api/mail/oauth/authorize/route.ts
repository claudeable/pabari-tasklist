import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { buildAuthUrl, DataCenter } from '@/lib/mail/zoho'
import { registerState } from '@/lib/mail/oauthState'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.redirect(new URL('/login', req.url))

  const dc = (req.nextUrl.searchParams.get('dc') ?? 'com') as DataCenter
  const state = randomBytes(16).toString('hex')
  registerState(state, user.id, dc)

  const authUrl = buildAuthUrl(state, dc)
  return NextResponse.redirect(authUrl)
}
