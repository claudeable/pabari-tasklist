import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { sendEmail } from '@/lib/email'
import { getUserByName } from '@/lib/users'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const name = req.nextUrl.searchParams.get('name') || 'Pedro'
  const to   = req.nextUrl.searchParams.get('to')   || ''

  const gmailUser = process.env.GMAIL_USER || '(not set)'
  const gmailPass = process.env.GMAIL_APP_PASSWORD ? '(set)' : '(NOT SET)'

  // Try user lookup
  const found = await getUserByName(name).catch(e => ({ error: String(e) }))

  // Try sending if ?to= provided
  let sendResult = 'skipped (no ?to= param)'
  if (to) {
    try {
      await sendEmail({ to, subject: 'Pabari ERP — Test Email', body: `This is a test email sent at ${new Date().toISOString()}` })
      sendResult = 'sent OK'
    } catch (e) {
      sendResult = `FAILED: ${String(e)}`
    }
  }

  return NextResponse.json({
    env: { GMAIL_USER: gmailUser, GMAIL_APP_PASSWORD: gmailPass },
    userLookup: { name, found },
    emailSend: sendResult,
  })
}
