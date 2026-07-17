/**
 * Zoho Mail API client.
 *
 * Supports multiple Zoho data centers (com/eu/in/au/jp).
 * All token refresh logic lives here so callers never deal with 401s directly.
 */
import { query, execute } from '@/lib/database'
import { encryptToken, decryptToken } from './encryption'

export type DataCenter = 'com' | 'eu' | 'in' | 'au' | 'jp'

function apiBase(dc: DataCenter) {
  const hosts: Record<DataCenter, string> = {
    com: 'https://mail.zoho.com',
    eu:  'https://mail.zoho.eu',
    in:  'https://mail.zoho.in',
    au:  'https://mail.zoho.com.au',
    jp:  'https://mail.zoho.jp',
  }
  return hosts[dc] ?? hosts.com
}

function accountsBase(dc: DataCenter) {
  const hosts: Record<DataCenter, string> = {
    com: 'https://accounts.zoho.com',
    eu:  'https://accounts.zoho.eu',
    in:  'https://accounts.zoho.in',
    au:  'https://accounts.zoho.com.au',
    jp:  'https://accounts.zoho.jp',
  }
  return hosts[dc] ?? hosts.com
}

export interface MailAccount {
  id:                   number
  user_id:              number
  provider:             string
  account_email:        string
  zoho_account_id:      string | null
  data_center:          DataCenter
  access_token_enc:     string
  refresh_token_enc:    string
  token_expiry:         string | null
  last_sync_at:         string | null
  last_sync_folder_id:  string | null
  sync_status:          string
  error_message:        string | null
}

export interface ZohoMessage {
  messageId:     string
  threadId:      string
  fromAddress:   string
  toAddress:     string
  subject:       string
  summary:       string       // Zoho's own snippet
  receivedTime:  string       // epoch ms string
  isRead:        boolean
  hasAttachment: boolean
  folderId:      string
  flagid?:       string
}

export interface ZohoMessageDetail extends ZohoMessage {
  content: string             // HTML body
}

// ── OAuth helpers ──────────────────────────────────────────────────────────────

export function buildAuthUrl(state: string, dc: DataCenter = 'com'): string {
  const base   = accountsBase(dc)
  const client = process.env.ZOHO_CLIENT_ID!
  const redir  = process.env.ZOHO_REDIRECT_URI!
  const scope  = 'ZohoMail.messages.READ,ZohoMail.messages.UPDATE,ZohoMail.folders.READ,ZohoMail.accounts.READ'
  return `${base}/oauth/v2/auth?response_type=code&client_id=${client}&redirect_uri=${encodeURIComponent(redir)}&scope=${encodeURIComponent(scope)}&access_type=offline&state=${state}`
}

export async function exchangeCode(code: string, dc: DataCenter = 'com'): Promise<{
  access_token: string; refresh_token: string; expires_in: number
}> {
  const base = accountsBase(dc)
  const res  = await fetch(`${base}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id:     process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      redirect_uri:  process.env.ZOHO_REDIRECT_URI!,
      grant_type:    'authorization_code',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error ?? 'Token exchange failed')
  return data
}

export async function refreshAccessToken(
  refreshTokenEncrypted: string,
  dc: DataCenter = 'com'
): Promise<{ access_token: string; expires_in: number }> {
  const base         = accountsBase(dc)
  const refreshToken = decryptToken(refreshTokenEncrypted)
  const res = await fetch(`${base}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.ZOHO_CLIENT_ID!,
      client_secret: process.env.ZOHO_CLIENT_SECRET!,
      grant_type:    'refresh_token',
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(data.error ?? 'Token refresh failed')
  return data
}

export async function revokeToken(tokenEncrypted: string, dc: DataCenter = 'com'): Promise<void> {
  const base  = accountsBase(dc)
  const token = decryptToken(tokenEncrypted)
  await fetch(`${base}/oauth/v2/token/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' })
}

// ── Token management ──────────────────────────────────────────────────────────

// Returns a valid (refreshed-if-needed) access token for the given account
export async function getValidAccessToken(account: MailAccount): Promise<string> {
  const expiry = account.token_expiry ? new Date(account.token_expiry).getTime() : 0
  const buffer = 5 * 60 * 1000 // refresh 5 min before expiry

  if (Date.now() < expiry - buffer) {
    return decryptToken(account.access_token_enc)
  }

  const { access_token, expires_in } = await refreshAccessToken(
    account.refresh_token_enc,
    account.data_center as DataCenter
  )

  const newExpiry = new Date(Date.now() + expires_in * 1000).toISOString()
  await execute(
    `UPDATE mail_accounts SET access_token_enc = $1, token_expiry = $2, sync_status = 'active', error_message = NULL WHERE id = $3`,
    [encryptToken(access_token), newExpiry, account.id]
  )

  return access_token
}

// ── Zoho API calls ────────────────────────────────────────────────────────────

export async function getZohoAccounts(accessToken: string, dc: DataCenter = 'com'): Promise<{
  accountId: string; emailAddress: string
}[]> {
  const base = apiBase(dc)
  const res  = await fetch(`${base}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const data = await res.json()
  if (!data.data) throw new Error('Could not fetch Zoho accounts')
  return data.data.map((a: Record<string, string>) => ({
    accountId:    a.accountId,
    emailAddress: a.emailAddress,
  }))
}

export async function getInboxFolder(
  accessToken: string,
  accountId: string,
  dc: DataCenter = 'com'
): Promise<{ folderId: string; folderName: string } | null> {
  const base = apiBase(dc)
  const res  = await fetch(`${base}/api/accounts/${accountId}/folders`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const data = await res.json()
  const inbox = (data.data ?? []).find(
    (f: Record<string, string>) => f.folderName?.toLowerCase() === 'inbox'
  )
  return inbox ? { folderId: inbox.folderId, folderName: inbox.folderName } : null
}

export async function fetchNewMessages(
  accessToken: string,
  accountId: string,
  folderId: string,
  dc: DataCenter = 'com',
  limit = 100,
  start = 1
): Promise<ZohoMessage[]> {
  const base = apiBase(dc)
  const url  = `${base}/api/accounts/${accountId}/messages/view`
    + `?folderId=${folderId}&sortorder=false&limit=${limit}&start=${start}`

  const res  = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const data = await res.json()
  const list = data.data ?? []
  return list.map((m: Record<string, unknown>) => ({
    messageId:     String(m.messageId ?? ''),
    threadId:      String(m.threadId ?? ''),
    fromAddress:   String(m.fromAddress ?? ''),
    toAddress:     String(m.toAddress ?? ''),
    subject:       String(m.subject ?? '(no subject)'),
    summary:       String(m.summary ?? ''),
    receivedTime:  String(m.receivedTime ?? '0'),
    isRead:        Boolean(m.isRead),
    hasAttachment: Boolean(m.hasAttachment),
    folderId:      String(m.folderId ?? folderId),
  }))
}

export async function fetchMessageContent(
  accessToken: string,
  accountId: string,
  messageId: string,
  dc: DataCenter = 'com'
): Promise<string> {
  const base = apiBase(dc)
  const res  = await fetch(`${base}/api/accounts/${accountId}/messages/${messageId}/content`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  })
  const data = await res.json()
  return String(data.data?.content ?? '')
}

export async function markMessageRead(
  accessToken: string,
  accountId: string,
  messageIds: string[],
  dc: DataCenter = 'com'
): Promise<void> {
  const base = apiBase(dc)
  await fetch(`${base}/api/accounts/${accountId}/updatemessage`, {
    method:  'PUT',
    headers: {
      Authorization:  `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode:       'markAsRead',
      messageId:  messageIds,
    }),
  })
}

export async function moveMessageToTrash(
  accessToken: string,
  accountId: string,
  messageId: string,
  dc: DataCenter = 'com'
): Promise<void> {
  const base = apiBase(dc)
  await fetch(`${base}/api/accounts/${accountId}/updatemessage`, {
    method:  'PUT',
    headers: {
      Authorization:  `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode:      'movetofolder',
      messageId: [messageId],
      folderName:'Trash',
    }),
  })
}

// ── Account record helpers ────────────────────────────────────────────────────

export async function getMailAccount(userId: number): Promise<MailAccount | null> {
  const rows = await query<MailAccount>(
    `SELECT * FROM mail_accounts WHERE user_id = $1 AND provider = 'zoho' LIMIT 1`,
    [userId]
  )
  return rows[0] ?? null
}

export async function getAllActiveAccounts(): Promise<MailAccount[]> {
  return query<MailAccount>(
    `SELECT * FROM mail_accounts WHERE sync_status = 'active'`
  )
}

export async function updateSyncTimestamp(accountId: number): Promise<void> {
  await execute(
    `UPDATE mail_accounts SET last_sync_at = now() WHERE id = $1`,
    [accountId]
  )
}

export async function markAccountError(accountId: number, msg: string): Promise<void> {
  await execute(
    `UPDATE mail_accounts SET sync_status = 'error', error_message = $1 WHERE id = $2`,
    [msg, accountId]
  )
}
