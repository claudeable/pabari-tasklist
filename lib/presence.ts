import { execute, query } from './database'

let presenceReady = false

async function ensurePresenceTable() {
  if (presenceReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS user_presence (
      user_id   TEXT PRIMARY KEY,
      user_name TEXT NOT NULL,
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  presenceReady = true
}

export async function pingPresence(userId: string, userName: string): Promise<void> {
  await ensurePresenceTable()
  await execute(
    `INSERT INTO user_presence (user_id, user_name, last_seen)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW(), user_name = $2`,
    [userId, userName]
  )
}

export async function getOnlineUsers(): Promise<{ user_id: string; user_name: string }[]> {
  await ensurePresenceTable()
  return query<{ user_id: string; user_name: string }>(
    `SELECT user_id, user_name FROM user_presence WHERE last_seen > NOW() - INTERVAL '2 minutes'`,
    []
  )
}
