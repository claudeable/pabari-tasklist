import webpush from 'web-push'
import { query, execute } from './database'

let configured = false
function configure() {
  if (configured) return
  const pub   = process.env.VAPID_PUBLIC_KEY
  const priv  = process.env.VAPID_PRIVATE_KEY
  const email = process.env.VAPID_EMAIL || 'mailto:admin@pabari.com'
  if (!pub || !priv) return
  webpush.setVapidDetails(email, pub, priv)
  configured = true
}

async function ensureTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         SERIAL PRIMARY KEY,
      user_email TEXT NOT NULL,
      user_name  TEXT NOT NULL DEFAULT '',
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
}

export async function saveSubscription(
  userEmail: string, userName: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  await ensureTable()
  await execute(
    `INSERT INTO push_subscriptions (user_email, user_name, endpoint, p256dh, auth)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE SET user_email=$1, user_name=$2, p256dh=$4, auth=$5`,
    [userEmail, userName, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  )
}

export async function removeSubscription(endpoint: string) {
  await execute(`DELETE FROM push_subscriptions WHERE endpoint=$1`, [endpoint])
}

export interface PushPayload {
  title: string
  body:  string
  url?:  string
  tag?:  string
}

async function sendOne(endpoint: string, p256dh: string, auth: string, payload: PushPayload) {
  configure()
  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload),
      { TTL: 86400 }
    )
  } catch (e: unknown) {
    const status = (e as { statusCode?: number }).statusCode
    if (status === 410 || status === 404) {
      // Subscription expired — remove it
      await execute(`DELETE FROM push_subscriptions WHERE endpoint=$1`, [endpoint]).catch(() => {})
    } else {
      console.error('[Push] send error:', e)
    }
  }
}

/** Send a push notification to all subscriptions for a given email */
export async function pushToEmail(email: string, payload: PushPayload) {
  if (!process.env.VAPID_PUBLIC_KEY) return
  try {
    await ensureTable()
    const rows = await query<{ endpoint: string; p256dh: string; auth: string }>(
      `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE LOWER(user_email)=LOWER($1)`,
      [email]
    )
    await Promise.all(rows.map(r => sendOne(r.endpoint, r.p256dh, r.auth, payload)))
  } catch (e) {
    console.error('[Push] pushToEmail error:', e)
  }
}
