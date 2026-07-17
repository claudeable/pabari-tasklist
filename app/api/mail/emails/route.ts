import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount } from '@/lib/mail/zoho'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

function auth() {
  const session = cookies().get('pabari-session')
  return session?.value ? verifyToken(session.value) : null
}

// GET /api/mail/emails?priority=Critical&category=Finance&unread=true&q=search&page=1
export async function GET(req: NextRequest) {
  const user = await auth()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(user.id)
  if (!account) return NextResponse.json({ connected: false, emails: [], total: 0 })

  const { searchParams } = req.nextUrl
  const priority = searchParams.get('priority')
  const category = searchParams.get('category')
  const unread   = searchParams.get('unread') === 'true'
  const q        = searchParams.get('q')?.trim() ?? ''
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const pageSize = 30
  const offset   = (page - 1) * pageSize

  const conditions: string[] = [`e.account_id = $1`, `e.is_deleted = false`]
  const params: unknown[]    = [account.id]

  if (unread) conditions.push(`e.is_read = false`)
  if (searchParams.get('archived') === 'true') {
    conditions.push(`e.is_archived = true`)
  } else {
    conditions.push(`e.is_archived = false`)
  }
  if (priority) { params.push(priority); conditions.push(`a.priority = $${params.length}`) }
  if (category) { params.push(category); conditions.push(`a.category = $${params.length}`) }
  if (q) {
    params.push(`%${q}%`)
    const idx = params.length
    conditions.push(`(e.subject ILIKE $${idx} OR e.from_name ILIKE $${idx} OR e.from_email ILIKE $${idx} OR a.summary ILIKE $${idx})`)
  }

  const where = `WHERE ${conditions.join(' AND ')}`

  const [countRows, emails] = await Promise.all([
    query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM mail_emails e LEFT JOIN mail_email_analysis a ON a.email_id = e.id ${where}`,
      params
    ),
    query<{
      id: number; zoho_message_id: string; from_email: string; from_name: string
      subject: string; snippet: string; received_at: string; is_read: boolean
      has_attachments: boolean; priority: string; category: string
      requires_action: boolean; deadline: string; summary: string; recommended_action: string
    }>(
      `SELECT e.id, e.zoho_message_id, e.from_email, e.from_name, e.subject, e.snippet,
              e.received_at, e.is_read, e.has_attachments,
              a.priority, a.category, a.requires_action, a.deadline, a.summary, a.recommended_action
       FROM mail_emails e
       LEFT JOIN mail_email_analysis a ON a.email_id = e.id
       ${where}
       ORDER BY e.received_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageSize, offset]
    ),
  ])

  return NextResponse.json({
    connected: true,
    emails,
    page,
    pageSize,
    total: parseInt(countRows[0]?.total ?? '0', 10),
  })
}
