import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getFinanceSummary } from '@/lib/db'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const summary = await getFinanceSummary()
  return NextResponse.json(summary)
}
