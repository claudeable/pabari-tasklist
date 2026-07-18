import { NextResponse } from 'next/server'
import { query, execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function POST() {
  const krishna = await query<{ email: string }>(
    `SELECT email FROM users WHERE LOWER(name) LIKE '%krishn%' LIMIT 1`
  )
  const krishnaEmail = krishna[0]?.email ?? 'rkrishnan@usm.co.ke'

  await execute(
    `UPDATE users
     SET reports_to = $1,
         companies  = $2
     WHERE LOWER(email) = 'yaynalem@usm.co.ke'`,
    [krishnaEmail, JSON.stringify(['ALL'])]
  )

  const rows = await query(`SELECT id, name, email, role, reports_to, companies FROM users WHERE LOWER(email) = 'yaynalem@usm.co.ke'`)
  return NextResponse.json({ ok: true, updated: rows[0], krishnaEmail })
}
