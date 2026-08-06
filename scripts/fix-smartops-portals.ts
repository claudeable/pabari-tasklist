/**
 * One-time script: set portals = ['smartops'] for Minesh Patel, Priyesh Patel, and Liam.
 * Run in Railway: railway run tsx scripts/fix-smartops-portals.ts
 */
import { query, execute } from '../lib/database'

const NAMES = ['minesh', 'priyesh', 'liam']

async function main() {
  const rows = await query<{ id: string; name: string; email: string; portals: string[] }>(
    `SELECT id, name, email, portals FROM users ORDER BY name`
  )

  const targets = rows.filter(u =>
    NAMES.some(n => u.name.toLowerCase().startsWith(n))
  )

  if (targets.length === 0) {
    console.log('No matching users found. Check their names in the DB.')
    process.exit(1)
  }

  console.log(`Found ${targets.length} user(s) to update:`)

  for (const u of targets) {
    console.log(`  ${u.name} <${u.email}> — current portals: [${(u.portals ?? []).join(', ')}]`)
    await execute(
      `UPDATE users SET portals = $1 WHERE id = $2`,
      [['smartops'], u.id]
    )
    console.log(`  ✓ Updated → portals: ['smartops']`)
  }

  console.log('\nDone. These users will now see only Smart Ops on the hub.')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
