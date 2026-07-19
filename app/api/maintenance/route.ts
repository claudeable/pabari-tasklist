import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMaintenanceLogs, createMaintenanceLog } from '@/lib/assets'

async function getUser() {
  const token = cookies().get('pabari-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = req.nextUrl
  const asset_id   = searchParams.get('asset_id')
  const vehicle_id = searchParams.get('vehicle_id')
  const logs = await getMaintenanceLogs({
    asset_id:   asset_id   ? parseInt(asset_id)   : undefined,
    vehicle_id: vehicle_id ? parseInt(vehicle_id) : undefined,
  })
  return NextResponse.json({ logs })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.date || !body.description)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const log = await createMaintenanceLog({ ...body, created_by: user.email })
  return NextResponse.json({ log }, { status: 201 })
}
