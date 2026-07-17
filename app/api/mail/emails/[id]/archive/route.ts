import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount } from '@/lib/mail/zoho'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// POST /api/mail/emails/[id]/archive — soft-archive in ERP (original stays in Zoho)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(parseInt(user.id))
  if (!account) return NextResponse.json({ error: 'No mail account' }, { status: 404 })

  const rows = await query<{ id: number }>(
    `SELECT id FROM mail_emails WHERE id = $1 AND account_id = $2`,
    [params.id, account.id]
  )
  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await execute(`UPDATE mail_emails SET is_archived = true, is_read = true WHERE id = $1`, [params.id])

  return NextResponse.json({ ok: true })
}

// DELETE /api/mail/emails/[id]/archive — unarchive
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(parseInt(user.id))
  if (!account) return NextResponse.json({ error: 'No mail account' }, { status: 404 })

  await execute(
    `UPDATE mail_emails SET is_archived = false WHERE id = $1 AND account_id = $2`,
    [params.id, account.id]
  )
  return NextResponse.json({ ok: true })
}
