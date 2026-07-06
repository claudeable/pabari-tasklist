import webpush from 'web-push'
import { query, execute } from './database'

export const VAPID_PUBLIC_KEY = 'BCBZxG0u3uHsKLcfShzJPs_K-9XLAiA1BFj2q0flXWqzgAWhdBZBwv-OFv7slY4GvEoUXdMH-gCksVuUGkPCs-I'

let vapidReady = false
function ensureVapid() {
  if (vapidReady) return
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!privateKey) return
  webpush.setVapidDetails('mailto:noreply@usm.co.ke', VAPID_PUBLIC_KEY, privateKey)
  vapidReady = true
}

let subTableReady = false
async function ensureSubTable() {
  if (subTableReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id         BIGSERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      endpoint   TEXT NOT NULL UNIQUE,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)`)
  subTableReady = true
}

interface SubRow { endpoint: string; p256dh: string; auth: string }

export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  await ensureSubTable()
  await execute(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id=$1, p256dh=$3, auth=$4`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  )
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await ensureSubTable()
  await execute(`DELETE FROM push_subscriptions WHERE endpoint=$1`, [endpoint])
}

export async function getSubscriptionsForUser(userId: string): Promise<SubRow[]> {
  await ensureSubTable()
  return query<SubRow>(
    `SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id=$1`,
    [userId]
  )
}

export async function getSubscriptionsForChannel(channel: string, excludeUserId: string): Promise<SubRow[]> {
  await ensureSubTable()
  let roleFilter: string
  if (channel === 'all') {
    roleFilter = `u.role IN ('admin','director','manager','staff','ceo')`
  } else if (channel === 'hod') {
    roleFilter = `u.role IN ('admin','director','manager')`
  } else if (channel === 'finance') {
    roleFilter = `(u.role IN ('admin','director','ceo') OR u.department='Finance' OR u.email='ateferi@kwale-group.com')`
  } else {
    return []
  }
  return query<SubRow>(
    `SELECT ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id::text = ps.user_id
     WHERE ${roleFilter} AND ps.user_id != $1`,
    [excludeUserId]
  )
}

export async function sendPush(subs: SubRow[], payload: object): Promise<void> {
  ensureVapid()
  if (!vapidReady || subs.length === 0) return
  const body = JSON.stringify(payload)
  await Promise.allSettled(
    subs.map(async sub => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        )
      } catch (err: unknown) {
        // 410 Gone = subscription expired
        if ((err as { statusCode?: number }).statusCode === 410) {
          await removeSubscription(sub.endpoint).catch(() => {})
        }
      }
    })
  )
}
