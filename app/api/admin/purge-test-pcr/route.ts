import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function POST() {
  const token = cookies().get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Delete the two test PCR records and their activity log traces
  await execute(`DELETE FROM petty_cash_requests WHERE req_no IN ('PCR-2026-0002','PCR-2026-0003')`)
  await execute(`DELETE FROM activity_log WHERE details LIKE '%PCR-2026-0002%' OR details LIKE '%PCR-2026-0003%'`)

  return NextResponse.json({ ok: true, message: 'Test records deleted' })
}
