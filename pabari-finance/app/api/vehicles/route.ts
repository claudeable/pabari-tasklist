import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getVehicles, createVehicle } from '@/lib/db'

async function auth(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = req.nextUrl
  const vehicles = await getVehicles({
    company: searchParams.get('company') || undefined,
    status:  searchParams.get('status')  || undefined,
  })
  return NextResponse.json({ vehicles })
}

export async function POST(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.reg_plate || !body.make || !body.company)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const vehicle = await createVehicle({ ...body, created_by: user.email })
  return NextResponse.json({ vehicle }, { status: 201 })
}
