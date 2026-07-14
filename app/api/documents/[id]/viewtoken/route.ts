import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { createViewToken } from '@/lib/docTokens'

function canAccess(user: { role: string; department: string } | null) {
  if (!user) return false
  return user.role === 'admin' || (user.role === 'director' && user.department === 'Director')
}

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!canAccess(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const viewToken = createViewToken(Number(params.id))
  return NextResponse.json({ token: viewToken })
}
