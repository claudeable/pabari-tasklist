import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await query<{ id: string; name: string; department: string; role: string }>(
      `SELECT id::text, name, department, role FROM users
       WHERE email != 'admin@usm.co.ke' AND id::text != $1
       ORDER BY name`,
      [String(user.id)]
    )
    return NextResponse.json({ users: rows.map(r => ({
      id: String(r.id), name: r.name, department: r.department || '', role: r.role,
    })) })
  } catch (err) {
    console.error('[chat/users]', err)
    return NextResponse.json({ users: [] })
  }
}
