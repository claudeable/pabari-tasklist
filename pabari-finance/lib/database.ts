import { Pool } from 'pg'

let _pool: Pool | null = null

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    })
  }
  return _pool
}

export async function query<T = Record<string, unknown>>(
  sql: string, params?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect()
  try {
    const res = await client.query(sql, params)
    return res.rows as T[]
  } finally {
    client.release()
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string, params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

export async function execute(sql: string, params?: unknown[]): Promise<void> {
  await query(sql, params)
}
