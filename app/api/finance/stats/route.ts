import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getFinanceStats } from '@/lib/finance'

const ALLOWED_NAMES  = ['harshil', 'benson']
const ALLOWED_EMAILS = ['rkrishnan@usm.co.ke', 'yaynalem@usm.co.ke']

export async function GET() {
  const session     = cookies().get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const first = currentUser.name.toLowerCase().split(' ')[0]
  const allowed = currentUser.role === 'admin' ||
    ALLOWED_NAMES.includes(first) ||
    ALLOWED_EMAILS.includes(currentUser.email)
  if (!allowed)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const stats = await getFinanceStats()
  return NextResponse.json(stats)
}
