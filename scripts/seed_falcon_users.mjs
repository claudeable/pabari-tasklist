/**
 * Creates falcon-01 and falcon-02 Pabari workspace accounts.
 *
 * These are anonymous alias-only accounts:
 *   - "email" field stores the alias itself (falcon-01 / falcon-02)
 *   - No real email, no identity linkage
 *   - Portal access: pil only
 *   - Password: changeme123
 *
 * Run: node scripts/seed_falcon_users.mjs
 * Requires DATABASE_URL in env (same as Railway pabari-tasklist service).
 */

import bcrypt from 'bcryptjs'
import pg from 'pg'

const { Client } = pg

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set')
  process.exit(1)
}

const FALCON_USERS = [
  { alias: 'falcon-01', name: 'Falcon 01' },
  { alias: 'falcon-02', name: 'Falcon 02' },
]

const PASSWORD = 'changeme123'

async function main() {
  const client = new Client({ connectionString: DATABASE_URL })
  await client.connect()

  const hash = await bcrypt.hash(PASSWORD, 10)

  for (const { alias, name } of FALCON_USERS) {
    const existing = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [alias]
    )
    if (existing.rows.length > 0) {
      console.log(`  SKIP   ${alias}  (already exists)`)
      continue
    }

    await client.query(
      `INSERT INTO users (name, email, role, department, reports_to, hod_email, companies, portals, password_hash)
       VALUES ($1, $2, 'staff', 'PIL', '', '', '["ALL"]', ARRAY['pil'], $3)`,
      [name, alias, hash]
    )
    console.log(`  CREATE ${alias}  — ${name}`)
  }

  await client.end()
  console.log('\nDone.')
}

main().catch(e => { console.error(e); process.exit(1) })
