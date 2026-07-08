import { query, execute } from './database'

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id         BIGSERIAL PRIMARY KEY,
      user_email TEXT        NOT NULL,
      user_name  TEXT        NOT NULL,
      action     TEXT        NOT NULL,
      details    TEXT        NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS activity_log_created_idx ON activity_log(created_at DESC)`)
  tableReady = true
}

export interface ActivityEntry {
  id:         number
  user_email: string
  user_name:  string
  action:     string
  details:    string
  created_at: string
}

export async function logActivity(
  userEmail: string,
  userName:  string,
  action:    string,
  details:   string = ''
): Promise<void> {
  try {
    await ensureTable()
    await execute(
      'INSERT INTO activity_log (user_email, user_name, action, details) VALUES ($1,$2,$3,$4)',
      [userEmail, userName, action, details]
    )
  } catch (err) {
    console.error('[activityLog] logActivity failed:', err)
  }
}

export async function getActivityLog(opts: {
  limit?: number
  from?:  string
  to?:    string
  user?:  string
}): Promise<ActivityEntry[]> {
  await ensureTable()
  const conditions: string[] = []
  const params: unknown[] = []
  let i = 1

  if (opts.from) { conditions.push(`created_at >= $${i++}`); params.push(opts.from + 'T00:00:00Z') }
  if (opts.to)   { conditions.push(`created_at <= $${i++}`); params.push(opts.to   + 'T23:59:59Z') }
  if (opts.user) { conditions.push(`LOWER(user_name) = LOWER($${i++})`); params.push(opts.user) }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''
  const limit = Math.min(opts.limit ?? 200, 500)

  const rows = await query<ActivityEntry>(
    `SELECT id, user_email, user_name, action, details, created_at::text
     FROM activity_log ${where}
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    params
  )
  return rows
}
