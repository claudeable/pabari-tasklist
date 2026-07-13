import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getFinanceStats } from '@/lib/finance'

const ALLOWED = ['harshil', 'benson']

export async function GET() {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const first = currentUser.name.toLowerCase().split(' ')[0]
  if (currentUser.role !== 'admin' && !ALLOWED.includes(first))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const stats = await getFinanceStats()
  return NextResponse.json(stats)
}
