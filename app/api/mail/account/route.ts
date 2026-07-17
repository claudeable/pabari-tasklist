import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount, revokeToken } from '@/lib/mail/zoho'
import { execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// GET /api/mail/account — returns connected account status (no sensitive data)
export async function GET() {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(user.id)
  if (!account) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected:     true,
    email:         account.account_email,
    data_center:   account.data_center,
    sync_status:   account.sync_status,
    error_message: account.error_message,
    last_sync_at:  account.last_sync_at,
    connected_at:  null, // not exposing
  })
}

// DELETE /api/mail/account — disconnect and revoke token
export async function DELETE(_req: NextRequest) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(user.id)
  if (!account) return NextResponse.json({ ok: true })

  try {
    await revokeToken(account.refresh_token_enc, account.data_center as import('@/lib/mail/zoho').DataCenter)
  } catch { /* best-effort revocation */ }

  await execute(`DELETE FROM mail_accounts WHERE id = $1`, [account.id])

  return NextResponse.json({ ok: true, disconnected: true })
}
