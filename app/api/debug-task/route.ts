import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getTasks } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const tasks = await getTasks()
  const finance = tasks
    .filter(t => t.category === 'Finance')
    .map(t => ({ id: t.id, particulars: t.particulars.slice(0, 50), responsible: t.responsible }))

  return NextResponse.json({ financeTasks: finance })
}
