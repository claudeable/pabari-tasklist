import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { query, execute } from '@/lib/database'

async function getUser() {
  const token = cookies().get('pabari-session')?.value
  return token ? verifyToken(token) : null
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { name, contact_person, phone, address } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  const rows = await query(
    `UPDATE dn_customers SET name=$1, contact_person=$2, phone=$3, address=$4 WHERE id=$5 RETURNING *`,
    [name.trim(), contact_person ?? '', phone ?? '', address ?? '', parseInt(params.id)]
  )
  if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ customer: rows[0] })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await execute(`DELETE FROM dn_customers WHERE id=$1`, [parseInt(params.id)])
  return NextResponse.json({ ok: true })
}
