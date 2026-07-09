import { query, execute } from './database'

let tablesReady: Promise<void> | null = null

function ensureTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = _initTables().catch(err => { tablesReady = null; throw err })
  }
  return tablesReady
}

async function _initTables(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS blocked_ips (
      id           SERIAL PRIMARY KEY,
      ip           VARCHAR(64) NOT NULL UNIQUE,
      reason       TEXT NOT NULL DEFAULT '',
      blocked_by   TEXT NOT NULL DEFAULT 'system',
      blocked_at   TIMESTAMPTZ DEFAULT NOW(),
      expires_at   TIMESTAMPTZ,
      is_permanent BOOLEAN DEFAULT false
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS security_events (
      id           SERIAL PRIMARY KEY,
      event_type   TEXT NOT NULL,
      ip           VARCHAR(64),
      user_email   TEXT,
      details      TEXT,
      threat_score INTEGER DEFAULT 0,
      auto_blocked BOOLEAN DEFAULT false,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_sec_events_ip      ON security_events(ip)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_sec_events_created ON security_events(created_at DESC)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_sec_events_type    ON security_events(event_type)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_blocked_ip         ON blocked_ips(ip)`)
}

function isPrivateIP(ip: string): boolean {
  return (
    ip === '127.0.0.1' || ip === '::1' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  )
}

export async function isIPBlocked(ip: string): Promise<{ blocked: boolean; reason?: string }> {
  if (!ip || ip === 'unknown' || isPrivateIP(ip)) return { blocked: false }
  await ensureTables()
  const rows = await query<{ reason: string }>(
    `SELECT reason FROM blocked_ips
     WHERE ip = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
    [ip]
  )
  if (rows.length > 0) return { blocked: true, reason: rows[0].reason }
  return { blocked: false }
}

export async function blockIP(
  ip: string, reason: string, blocked_by = 'system', hours?: number
): Promise<void> {
  await ensureTables()
  const expires_at = hours ? new Date(Date.now() + hours * 3_600_000).toISOString() : null
  await execute(
    `INSERT INTO blocked_ips (ip, reason, blocked_by, expires_at, is_permanent)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (ip) DO UPDATE
       SET reason=$2, blocked_by=$3, blocked_at=NOW(), expires_at=$4, is_permanent=$5`,
    [ip, reason, blocked_by, expires_at, !hours]
  )
}

export async function unblockIP(ip: string): Promise<void> {
  await ensureTables()
  await execute('DELETE FROM blocked_ips WHERE ip = $1', [ip])
}

export async function logSecurityEvent(
  event_type: string,
  ip: string,
  user_email: string,
  details: string,
  threat_score: number,
  auto_blocked = false
): Promise<void> {
  await ensureTables()
  await execute(
    `INSERT INTO security_events (event_type, ip, user_email, details, threat_score, auto_blocked)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [event_type, ip, user_email, details, threat_score, auto_blocked]
  ).catch(() => {})
}

export async function analyzeThreat(ip: string, user_email?: string): Promise<number> {
  if (!ip || ip === 'unknown' || isPrivateIP(ip)) return 0
  await ensureTables()
  let score = 0

  // Brute force: failed logins from this IP in last 5 minutes
  const [failures, accounts, bulkReq] = await Promise.all([
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM security_events
       WHERE ip = $1 AND event_type = 'login_failed'
       AND created_at > NOW() - INTERVAL '5 minutes'`,
      [ip]
    ),
    // Credential stuffing: targeting multiple accounts from same IP
    query<{ count: string }>(
      `SELECT COUNT(DISTINCT user_email) as count FROM security_events
       WHERE ip = $1 AND event_type = 'login_failed'
       AND created_at > NOW() - INTERVAL '10 minutes'`,
      [ip]
    ),
    // Bulk API scraping: many requests in 1 minute
    query<{ count: string }>(
      `SELECT COUNT(*) as count FROM security_events
       WHERE ip = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
      [ip]
    ),
  ])

  const failCount  = Number(failures[0]?.count || 0)
  const acctCount  = Number(accounts[0]?.count || 0)
  const reqCount   = Number(bulkReq[0]?.count || 0)

  // Brute force scoring
  if (failCount >= 3)  score += 30
  if (failCount >= 6)  score += 25
  if (failCount >= 10) score += 25

  // Credential stuffing (different accounts from same IP)
  if (acctCount >= 3) score += 40
  if (acctCount >= 5) score += 30

  // API flood
  if (reqCount >= 60)  score += 20
  if (reqCount >= 100) score += 40

  // Off-hours login attempt (10pm–6am EAT = 19:00–03:00 UTC)
  const utcHour = new Date().getUTCHours()
  if (utcHour >= 19 || utcHour < 3) score += 10

  return Math.min(score, 100)
}

// Call this at the top of every sensitive API route
export async function enforceIPBlock(ip: string): Promise<{ blocked: boolean; response?: Response }> {
  const { blocked, reason } = await isIPBlocked(ip)
  if (blocked) {
    return {
      blocked: true,
      response: new Response(
        JSON.stringify({ error: 'Access denied.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      ),
    }
  }
  return { blocked: false }
}

export async function getBlockedIPs() {
  await ensureTables()
  return query<Record<string, unknown>>(
    'SELECT * FROM blocked_ips ORDER BY blocked_at DESC'
  )
}

export async function getSecurityEvents(limit = 200) {
  await ensureTables()
  return query<Record<string, unknown>>(
    'SELECT * FROM security_events ORDER BY created_at DESC LIMIT $1',
    [limit]
  )
}

export async function getSecurityStats() {
  await ensureTables()
  const [blocked, eventsToday, highThreat, autoBlocked] = await Promise.all([
    query<{ count: string }>(`SELECT COUNT(*) as count FROM blocked_ips WHERE (expires_at IS NULL OR expires_at > NOW())`),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM security_events WHERE created_at > NOW() - INTERVAL '24 hours'`),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM security_events WHERE threat_score >= 70 AND created_at > NOW() - INTERVAL '24 hours'`),
    query<{ count: string }>(`SELECT COUNT(*) as count FROM security_events WHERE auto_blocked = true AND created_at > NOW() - INTERVAL '24 hours'`),
  ])
  return {
    blockedIPs:     Number(blocked[0]?.count     || 0),
    eventsToday:    Number(eventsToday[0]?.count  || 0),
    highThreat:     Number(highThreat[0]?.count   || 0),
    autoBlockedToday: Number(autoBlocked[0]?.count || 0),
  }
}
