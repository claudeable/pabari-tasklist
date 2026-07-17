import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount, getValidAccessToken, markMessageRead } from '@/lib/mail/zoho'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// POST /api/mail/emails/[id]/read — mark email read in ERP + sync to Zoho
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(parseInt(user.id))
  if (!account) return NextResponse.json({ error: 'No mail account' }, { status: 404 })

  const rows = await query<{ zoho_message_id: string }>(
    `SELECT zoho_message_id FROM mail_emails WHERE id = $1 AND account_id = $2`,
    [params.id, account.id]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Update local DB immediately
  await execute(`UPDATE mail_emails SET is_read = true WHERE id = $1`, [params.id])

  // Sync to Zoho asynchronously (don't block response)
  if (account.zoho_account_id) {
    getValidAccessToken(account)
      .then(token => markMessageRead(token, account.zoho_account_id!, [rows[0].zoho_message_id], account.data_center as import('@/lib/mail/zoho').DataCenter))
      .catch(e => console.warn('[mail/read sync]', e))
  }

  return NextResponse.json({ ok: true })
}
