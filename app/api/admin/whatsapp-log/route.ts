import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const rows = await query<{
      id: number; message_id: string; to_phone: string
      status: string; error_code: string; error_msg: string; created_at: string
    }>(
      `SELECT id, message_id, to_phone, status, error_code, error_msg, created_at
       FROM whatsapp_delivery_log ORDER BY created_at DESC LIMIT 200`
    )
    return NextResponse.json({ logs: rows })
  } catch {
    return NextResponse.json({ logs: [] })
  }
}
