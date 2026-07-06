import { query, queryOne, execute } from './database'

export type ChatChannel = 'all' | 'hod' | 'finance' | 'system'

export interface ChatMessage {
  id:         number
  user_id:    string
  user_name:  string
  message:    string
  channel:    ChatChannel
  is_system:  boolean
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
      channel    TEXT NOT NULL DEFAULT 'all',
      is_system  BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await execute(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'all'`)
  await execute(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false`)
  tableReady = true
}

function rowToMsg(r: Record<string, unknown>): ChatMessage {
  return {
    id:        Number(r.id),
    user_id:   String(r.user_id),
    user_name: String(r.user_name),
    message:   String(r.message),
    channel:   (r.channel as ChatChannel) || 'all',
    is_system: Boolean(r.is_system),
    created_at:String(r.created_at),
  }
}

export async function getMessages(channel: ChatChannel, sinceId?: number): Promise<ChatMessage[]> {
  await ensureTable()
  let rows: Record<string, unknown>[]
  if (sinceId && sinceId > 0) {
    rows = await query<Record<string, unknown>>(
      'SELECT * FROM chat_messages WHERE channel=$1 AND id>$2 ORDER BY id ASC LIMIT 100',
      [channel, sinceId]
    )
  } else {
    rows = await query<Record<string, unknown>>(
      'SELECT * FROM chat_messages WHERE channel=$1 ORDER BY id DESC LIMIT 50',
      [channel]
    )
    rows = rows.reverse()
  }
  return rows.map(rowToMsg)
}

export async function postMessage(userId: string, userName: string, message: string, channel: ChatChannel): Promise<ChatMessage> {
  await ensureTable()
  const row = await queryOne<Record<string, unknown>>(
    'INSERT INTO chat_messages (user_id, user_name, message, channel) VALUES ($1,$2,$3,$4) RETURNING *',
    [userId, userName, message.trim(), channel]
  )
  if (!row) throw new Error('Failed to insert message')
  return rowToMsg(row)
}

export async function postSystemMessage(message: string): Promise<void> {
  try {
    await execute(
      'INSERT INTO chat_messages (user_id, user_name, message, channel, is_system) VALUES ($1,$2,$3,$4,$5)',
      ['system', 'System', message, 'system', true]
    )
  } catch (err) {
    console.error('[chat] postSystemMessage failed:', err)
  }
}
