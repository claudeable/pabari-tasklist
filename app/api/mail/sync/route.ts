/**
 * POST /api/mail/sync — fetches new emails from Zoho, runs AI analysis, stores metadata.
 *
 * Called by:
 *   1. The Python background service (with ?all=true to process all accounts)
 *   2. Manual "Refresh" button in the UI (processes current user's account)
 *
 * Authenticated via JWT session OR via SYNC_SECRET header for the Python service.
 */
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import {
  getAllActiveAccounts, getMailAccount, getValidAccessToken,
  fetchNewMessages, getInboxFolder, updateSyncTimestamp, markAccountError,
  type MailAccount, type DataCenter,
} from '@/lib/mail/zoho'
import { analyseEmail, persistAnalysis } from '@/lib/mail/analyze'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

async function syncAccount(account: MailAccount): Promise<{ fetched: number; analysed: number }> {
  let fetched   = 0
  let analysed  = 0
  const dc = account.data_center as DataCenter

  const token       = await getValidAccessToken(account)
  const accountId   = account.zoho_account_id!

  // Ensure we have an inbox folder ID
  let folderId = account.last_sync_folder_id
  if (!folderId) {
    const inbox = await getInboxFolder(token, accountId, dc)
    folderId    = inbox?.folderId ?? null
    if (folderId) {
      await execute(`UPDATE mail_accounts SET last_sync_folder_id = $1 WHERE id = $2`, [folderId, account.id])
    }
  }
  if (!folderId) return { fetched: 0, analysed: 0 }

  // Fetch messages in pages, stopping once we see ones we already have
  let start   = 1
  let hasMore = true

  while (hasMore) {
    const messages = await fetchNewMessages(token, accountId, folderId, dc, 100, start)
    if (!messages.length) break

    for (const msg of messages) {
      // Check if already in DB
      const existing = await query<{ id: number; is_read: boolean }>(
        `SELECT id, is_read FROM mail_emails WHERE account_id = $1 AND zoho_message_id = $2`,
        [account.id, msg.messageId]
      )

      if (existing.length > 0) {
        // Sync read status from Zoho → local DB
        if (existing[0].is_read !== msg.isRead) {
          await execute(`UPDATE mail_emails SET is_read = $1 WHERE id = $2`, [msg.isRead, existing[0].id])
        }
        // Stop paginating when we hit emails we've already processed (sorted desc by time)
        hasMore = false
        break
      }

      const receivedAt = new Date(parseInt(msg.receivedTime, 10)).toISOString()
      const fromParts  = msg.fromAddress.match(/^(.*?)\s*<(.+)>$/)
      const fromName   = fromParts?.[1]?.trim() ?? ''
      const fromEmail  = fromParts?.[2]?.trim() ?? msg.fromAddress

      const inserted = await query<{ id: number }>(
        `INSERT INTO mail_emails
           (account_id, zoho_message_id, zoho_thread_id, from_email, from_name,
            subject, snippet, received_at, is_read, has_attachments, folder, zoho_folder_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'INBOX',$11)
         ON CONFLICT (account_id, zoho_message_id) DO NOTHING
         RETURNING id`,
        [
          account.id, msg.messageId, msg.threadId || null,
          fromEmail, fromName, msg.subject || '(no subject)',
          msg.summary?.slice(0, 500) ?? '',
          receivedAt, msg.isRead, msg.hasAttachment, folderId,
        ]
      )

      if (!inserted[0]) continue // already existed (race condition)
      fetched++

      // AI analysis (don't await — process async so sync completes fast)
      const emailId   = inserted[0].id
      const analysis  = await analyseEmail(msg.subject, fromEmail, fromName, msg.summary ?? '')
      await persistAnalysis(emailId, analysis, account.user_id)
      analysed++
    }

    if (messages.length < 100) break
    start += 100
  }

  await updateSyncTimestamp(account.id)
  return { fetched, analysed }
}

export async function POST(req: NextRequest) {
  // Auth: session cookie (UI) OR sync secret header (Python service)
  const syncSecret = req.headers.get('x-sync-secret')
  const isService  = syncSecret && syncSecret === process.env.MAIL_SYNC_SECRET

  if (!isService) {
    const session = cookies().get('pabari-session')
    const user = session?.value ? await verifyToken(session.value) : null
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const all = req.nextUrl.searchParams.get('all') === 'true' && isService

  try {
    if (all) {
      // Service mode: process all active accounts
      const accounts = await getAllActiveAccounts()
      const results: Record<string, unknown>[] = []

      for (const account of accounts) {
        try {
          const r = await syncAccount(account)
          results.push({ account_id: account.id, email: account.account_email, ...r })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await markAccountError(account.id, msg)
          results.push({ account_id: account.id, error: msg })
        }
      }

      return NextResponse.json({ ok: true, results })
    } else {
      // UI mode: process current user's account only
      const session = cookies().get('pabari-session')
      const user = session?.value ? await verifyToken(session.value) : null
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

      const account = await getMailAccount(parseInt(user.id))
      if (!account) return NextResponse.json({ ok: true, fetched: 0, message: 'No account connected' })

      const result = await syncAccount(account)
      return NextResponse.json({ ok: true, ...result })
    }
  } catch (e) {
    console.error('[mail/sync]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
