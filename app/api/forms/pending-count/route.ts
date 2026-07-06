import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

const HOS_EMAIL     = 'rkrishnan@usm.co.ke'
const FINANCE_EMAIL = 'ateferi@kwale-group.com'
const SURESH_EMAIL  = 'ssuresh@kwale-group.com'
const AHMAD_EMAIL   = 'ahmad@usm.co.ke'
const SABINA_EMAIL  = 'smutua@kwale-group.com'

function cnt(rows: { count: string }[]) {
  return parseInt(rows[0]?.count ?? '0', 10)
}

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const uid       = parseInt(String(user.id ?? ''), 10) || 0
  const firstName = (user.name?.split(' ')[0] ?? '').toLowerCase()
  const isHR      = user.department === 'HR' || user.role === 'admin'
  const isAdmin   = user.role === 'admin'

  let leave = 0
  let pettyCashGeneral = 0
  let pettyCashKiscol  = 0

  try {
    if (isHR) {
      const r = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status='pending_hr'`)
      leave += cnt(r)
    }
    if (isAdmin) {
      const r = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM leave_requests WHERE status='pending_hk'`)
      leave += cnt(r)
    }
  } catch { /* table may not exist yet */ }

  try {
    if (user.email?.toLowerCase() === HOS_EMAIL) {
      const r = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hos' AND form_type='general'`)
      pettyCashGeneral += cnt(r)
    }
    if (user.email?.toLowerCase() === SURESH_EMAIL) {
      const r = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hos' AND form_type='kiscol'`)
      pettyCashKiscol += cnt(r)
    }
    if (user.email?.toLowerCase() === AHMAD_EMAIL) {
      const r = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_hod' AND form_type='kiscol'`)
      pettyCashKiscol += cnt(r)
    }
    if (user.email?.toLowerCase() === FINANCE_EMAIL) {
      const r = await query<{count:string}>(`SELECT COUNT(*)::text AS count FROM petty_cash_requests WHERE status='pending_finance' AND form_type='general'`)
      pettyCashGeneral += cnt(r)
    }
    // HOD match for general form
    if (uid > 0 || firstName) {
      const r = await query<{count:string}>(
        `SELECT COUNT(*)::text AS count FROM petty_cash_requests
         WHERE status='pending_hod' AND form_type='general'
         AND (hod_id=$1 OR LOWER(SPLIT_PART(hod_name,' ',1))=LOWER($2))`,
        [uid, firstName]
      )
      pettyCashGeneral += cnt(r)
    }
    // Sabina is Paul's deputy — she sees Paul's pending_hod requests
    if (user.email?.toLowerCase() === SABINA_EMAIL) {
      const r = await query<{count:string}>(
        `SELECT COUNT(*)::text AS count FROM petty_cash_requests
         WHERE status='pending_hod' AND form_type='general'
         AND LOWER(SPLIT_PART(hod_name,' ',1))='paul'`
      )
      pettyCashGeneral += cnt(r)
    }
  } catch { /* table may not exist yet */ }

  return NextResponse.json({
    leave,
    pettyCashGeneral,
    pettyCashKiscol,
    total: leave + pettyCashGeneral + pettyCashKiscol,
  })
}
