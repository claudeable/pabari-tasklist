import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount } from '@/lib/mail/zoho'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

// GET /api/mail/stats — email intelligence stats for the dashboard
export async function GET() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(parseInt(user.id))
  if (!account) return NextResponse.json({ connected: false })

  const [today, unread24h, categories, criticals] = await Promise.all([
    // Today's stats
    query<{ total: string; critical: string; high: string; medium: string; low: string; unread: string; requires_action: string }>(
      `SELECT
         COUNT(e.id)::text AS total,
         COUNT(CASE WHEN a.priority = 'Critical' THEN 1 END)::text AS critical,
         COUNT(CASE WHEN a.priority = 'High' THEN 1 END)::text AS high,
         COUNT(CASE WHEN a.priority = 'Medium' THEN 1 END)::text AS medium,
         COUNT(CASE WHEN a.priority = 'Low' THEN 1 END)::text AS low,
         COUNT(CASE WHEN e.is_read = false THEN 1 END)::text AS unread,
         COUNT(CASE WHEN a.requires_action = true AND e.is_read = false THEN 1 END)::text AS requires_action
       FROM mail_emails e
       LEFT JOIN mail_email_analysis a ON a.email_id = e.id
       WHERE e.account_id = $1 AND e.is_archived = false AND e.is_deleted = false
         AND e.received_at >= now() - interval '24 hours'`,
      [account.id]
    ),

    // Emails unread for >24h
    query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM mail_emails
       WHERE account_id = $1 AND is_read = false AND is_archived = false
         AND received_at < now() - interval '24 hours'`,
      [account.id]
    ),

    // Category breakdown (last 7 days)
    query<{ category: string; count: string }>(
      `SELECT a.category, COUNT(*)::text AS count
       FROM mail_emails e
       JOIN mail_email_analysis a ON a.email_id = e.id
       WHERE e.account_id = $1 AND e.received_at >= now() - interval '7 days'
         AND e.is_deleted = false
       GROUP BY a.category ORDER BY count DESC LIMIT 8`,
      [account.id]
    ),

    // Recent critical emails (unread)
    query<{ id: number; subject: string; from_name: string; from_email: string; received_at: string; summary: string; deadline: string }>(
      `SELECT e.id, e.subject, e.from_name, e.from_email, e.received_at, a.summary, a.deadline
       FROM mail_emails e
       JOIN mail_email_analysis a ON a.email_id = e.id
       WHERE e.account_id = $1 AND a.priority = 'Critical' AND e.is_read = false
         AND e.is_archived = false
       ORDER BY e.received_at DESC LIMIT 5`,
      [account.id]
    ),
  ])

  const s = today[0] ?? { total:'0', critical:'0', high:'0', medium:'0', low:'0', unread:'0', requires_action:'0' }

  return NextResponse.json({
    connected:       true,
    account_email:   account.account_email,
    last_sync_at:    account.last_sync_at,
    today: {
      total:          parseInt(s.total),
      critical:       parseInt(s.critical),
      high:           parseInt(s.high),
      medium:         parseInt(s.medium),
      low:            parseInt(s.low),
      unread:         parseInt(s.unread),
      requires_action:parseInt(s.requires_action),
    },
    unread_over_24h: parseInt(unread24h[0]?.count ?? '0'),
    categories,
    critical_emails: criticals,
  })
}
