import { query, execute } from './database'

let tableReady = false

async function ensureTable() {
  if (tableReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS manager_members (
      id           SERIAL PRIMARY KEY,
      manager_email TEXT NOT NULL,
      member_name   TEXT NOT NULL,
      UNIQUE(manager_email, member_name)
    )
  `)
  tableReady = true
}

export async function getManagerMembers(managerEmail: string): Promise<string[]> {
  await ensureTable()
  const rows = await query<{ member_name: string }>(
    'SELECT member_name FROM manager_members WHERE LOWER(manager_email) = LOWER($1) ORDER BY member_name',
    [managerEmail]
  )
  return rows.map(r => r.member_name)
}

export async function addManagerMember(managerEmail: string, memberName: string): Promise<void> {
  await ensureTable()
  await execute(
    'INSERT INTO manager_members (manager_email, member_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [managerEmail, memberName]
  )
}

export async function removeManagerMember(managerEmail: string, memberName: string): Promise<void> {
  await ensureTable()
  await execute(
    'DELETE FROM manager_members WHERE LOWER(manager_email) = LOWER($1) AND LOWER(member_name) = LOWER($2)',
    [managerEmail, memberName]
  )
}
