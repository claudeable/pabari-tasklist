import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount } from '@/lib/mail/zoho'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

// GET /api/mail/timeline — executive email timeline sorted by importance then time
export async function GET(req: NextRequest) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(parseInt(user.id))
  if (!account) return NextResponse.json({ connected: false, events: [] })

  const since = req.nextUrl.searchParams.get('since') ?? 'today'
  const interval = since === 'week' ? '7 days' : '24 hours'

  const emails = await query<{
    id: number; subject: string; from_name: string; from_email: string
    received_at: string; is_read: boolean; priority: string
    category: string; summary: string; requires_action: boolean; deadline: string
  }>(
    `SELECT e.id, e.subject, e.from_name, e.from_email, e.received_at, e.is_read,
            a.priority, a.category, a.summary, a.requires_action, a.deadline
     FROM mail_emails e
     LEFT JOIN mail_email_analysis a ON a.email_id = e.id
     WHERE e.account_id = $1 AND e.is_archived = false AND e.is_deleted = false
       AND e.received_at >= now() - interval '${interval}'
     ORDER BY
       CASE a.priority
         WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4
       END,
       e.received_at DESC
     LIMIT 50`,
    [account.id]
  )

  // Group by hour for timeline display
  const events = emails.map(e => ({
    id:              e.id,
    time:            e.received_at,
    hour:            new Date(e.received_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    subject:         e.subject,
    from:            e.from_name || e.from_email,
    summary:         e.summary || e.subject,
    priority:        e.priority || 'Medium',
    category:        e.category || 'General',
    is_read:         e.is_read,
    requires_action: e.requires_action,
    deadline:        e.deadline,
  }))

  return NextResponse.json({ connected: true, events, interval })
}
