import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount, getValidAccessToken, fetchMessageContent } from '@/lib/mail/zoho'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// GET /api/mail/emails/[id] — full email details including content from Zoho
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(parseInt(user.id))
  if (!account) return NextResponse.json({ error: 'No mail account connected' }, { status: 404 })

  const rows = await query<{
    id: number; zoho_message_id: string; from_email: string; from_name: string
    to_emails: string[]; subject: string; snippet: string; received_at: string
    is_read: boolean; has_attachments: boolean; folder: string
    priority: string; category: string; requires_action: boolean
    deadline: string; summary: string; recommended_action: string
    task_ids: number[]
  }>(
    `SELECT e.id, e.zoho_message_id, e.from_email, e.from_name, e.to_emails,
            e.subject, e.snippet, e.received_at, e.is_read, e.has_attachments, e.folder,
            a.priority, a.category, a.requires_action, a.deadline, a.summary, a.recommended_action,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT et.task_id), NULL) AS task_ids
     FROM mail_emails e
     LEFT JOIN mail_email_analysis a ON a.email_id = e.id
     LEFT JOIN mail_email_tasks et ON et.email_id = e.id
     WHERE e.id = $1 AND e.account_id = $2
     GROUP BY e.id, a.id`,
    [params.id, account.id]
  )

  if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const email = rows[0]

  // Fetch live content from Zoho on demand (not stored in DB to save space)
  let content = ''
  try {
    const token = await getValidAccessToken(account)
    content = await fetchMessageContent(token, account.zoho_account_id!, email.zoho_message_id, account.data_center as import('@/lib/mail/zoho').DataCenter)
  } catch { /* return without content — snippet is fallback */ }

  return NextResponse.json({ ...email, content })
}
