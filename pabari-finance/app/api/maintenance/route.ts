import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getMaintenanceLogs, createMaintenanceLog } from '@/lib/db'

async function auth(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await auth(req)
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
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.date || !body.description)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const log = await createMaintenanceLog({ ...body, created_by: user.email })
  return NextResponse.json({ log }, { status: 201 })
}
