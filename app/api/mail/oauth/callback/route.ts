import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode, getZohoAccounts, getInboxFolder } from '@/lib/mail/zoho'
import { encryptToken } from '@/lib/mail/encryption'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

// We import verifyState from the authorize route to validate CSRF state
// To avoid circular imports, we re-implement a simple in-memory store here
// In production this should be a Redis or DB-backed store
const pendingStates = new Map<string, { userId: string; dc: string; createdAt: number }>()

// The authorize route writes to this shared map via module-level state
// In a single Next.js instance this works; for multi-instance use DB/Redis
export function registerState(state: string, userId: string, dc: string) {
  pendingStates.set(state, { userId, dc, createdAt: Date.now() })
}

function popState(state: string): { userId: string; dc: string } | null {
  const entry = pendingStates.get(state)
  if (!entry) return null
  if (Date.now() - entry.createdAt > 10 * 60 * 1000) { pendingStates.delete(state); return null }
  pendingStates.delete(state)
  return { userId: entry.userId, dc: entry.dc }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  if (error) {
    return NextResponse.redirect(`${baseUrl}/centre?tab=mail&error=${encodeURIComponent(error)}`)
  }
  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/centre?tab=mail&error=missing_params`)
  }

  // For single-instance: state is stored in authorize route's module-level map.
  // We access it via a shared in-process reference.
  // Retrieve state from authorize module
  const { verifyState } = await import('@/app/api/mail/oauth/authorize/route')
  const stateData = verifyState(state)

  if (!stateData) {
    return NextResponse.redirect(`${baseUrl}/centre?tab=mail&error=invalid_state`)
  }

  const { userId, dc } = stateData

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code, dc as import('@/lib/mail/zoho').DataCenter)

    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    const accessEnc  = encryptToken(tokens.access_token)
    const refreshEnc = encryptToken(tokens.refresh_token)

    // Get Zoho account info
    const accounts = await getZohoAccounts(tokens.access_token, dc as import('@/lib/mail/zoho').DataCenter)
    if (!accounts.length) throw new Error('No Zoho accounts found')

    const zohoAccount = accounts[0]

    // Get INBOX folder ID for initial sync bookmarking
    const inbox = await getInboxFolder(tokens.access_token, zohoAccount.accountId, dc as import('@/lib/mail/zoho').DataCenter)

    // Upsert mail_account record (supports reconnect)
    const existing = await query<{ id: number }>(
      `SELECT id FROM mail_accounts WHERE user_id = $1 AND provider = 'zoho'`,
      [userId]
    )

    if (existing.length > 0) {
      await execute(
        `UPDATE mail_accounts SET
           account_email = $1, zoho_account_id = $2, data_center = $3,
           access_token_enc = $4, refresh_token_enc = $5, token_expiry = $6,
           last_sync_folder_id = $7, sync_status = 'active', error_message = NULL,
           connected_at = now()
         WHERE id = $8`,
        [zohoAccount.emailAddress, zohoAccount.accountId, dc,
         accessEnc, refreshEnc, expiry, inbox?.folderId ?? null, existing[0].id]
      )
    } else {
      await execute(
        `INSERT INTO mail_accounts
           (user_id, provider, account_email, zoho_account_id, data_center,
            access_token_enc, refresh_token_enc, token_expiry, last_sync_folder_id)
         VALUES ($1,'zoho',$2,$3,$4,$5,$6,$7,$8)`,
        [userId, zohoAccount.emailAddress, zohoAccount.accountId, dc,
         accessEnc, refreshEnc, expiry, inbox?.folderId ?? null]
      )
    }

    return NextResponse.redirect(`${baseUrl}/centre?tab=mail&connected=1`)
  } catch (e) {
    console.error('[mail/oauth/callback]', e)
    const msg = e instanceof Error ? e.message : 'OAuth error'
    return NextResponse.redirect(`${baseUrl}/centre?tab=mail&error=${encodeURIComponent(msg)}`)
  }
}
