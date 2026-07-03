import { NextRequest, NextResponse } from 'next/server'
import { getTaskAudit } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const audit = await getTaskAudit(params.id)
  return NextResponse.json(audit)
}
