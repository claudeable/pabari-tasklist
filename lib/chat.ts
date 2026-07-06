import { query, queryOne, execute } from './database'

export interface ChatMessage {
  id:         number
  user_id:    string
  user_name:  string
  message:    string
  created_at: string
}

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         BIGSERIAL PRIMARY KEY,
      user_id    TEXT NOT NULL,
      user_name  TEXT NOT NULL,
      message    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ`)
  tableReady = true
}

export async function getMessages(sinceId?: number): Promise<ChatMessage[]> {
  await ensureTable()
  let rows: Record<string, unknown>[]
  if (sinceId && sinceId > 0) {
    rows = await query<Record<string, unknown>>(
      'SELECT * FROM chat_messages WHERE id > $1 ORDER BY id ASC LIMIT 100',
      [sinceId]
    )
  } else {
    rows = await query<Record<string, unknown>>(
      'SELECT * FROM chat_messages ORDER BY id DESC LIMIT 50'
    )
    rows = rows.reverse()
  }
  return rows.map(r => ({
    id:         Number(r.id),
    user_id:    String(r.user_id),
    user_name:  String(r.user_name),
    message:    String(r.message),
    created_at: String(r.created_at),
  }))
}

export async function postMessage(userId: string, userName: string, message: string): Promise<ChatMessage> {
  await ensureTable()
  const row = await queryOne<Record<string, unknown>>(
    'INSERT INTO chat_messages (user_id, user_name, message) VALUES ($1,$2,$3) RETURNING *',
    [userId, userName, message.trim()]
  )
  if (!row) throw new Error('Failed to insert message')
  return {
    id:         Number(row.id),
    user_id:    String(row.user_id),
    user_name:  String(row.user_name),
    message:    String(row.message),
    created_at: String(row.created_at),
  }
}

export async function pingUser(userId: string): Promise<void> {
  await ensureTable()
  await execute('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId])
}

export interface OnlineUser {
  id:        string
  name:      string
  role:      string
  last_seen: string
}

export async function getOnlineUsers(): Promise<OnlineUser[]> {
  await ensureTable()
  const rows = await query<Record<string, unknown>>(
    `SELECT id, name, role, last_seen FROM users
     WHERE last_seen > NOW() - INTERVAL '5 minutes'
     ORDER BY name`
  )
  return rows.map(r => ({
    id:        String(r.id),
    name:      String(r.name),
    role:      String(r.role),
    last_seen: String(r.last_seen),
  }))
}
