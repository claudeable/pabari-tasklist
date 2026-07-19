import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getVehicles, createVehicle } from '@/lib/assets'

async function getUser() {
  const token = cookies().get('pabari-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = req.nextUrl
  const vehicles = await getVehicles({
    company: searchParams.get('company') || undefined,
    status:  searchParams.get('status')  || undefined,
  })
  return NextResponse.json({ vehicles })
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const firstName = user.name.toLowerCase().split(' ')[0]
  if (user.role !== 'admin' && firstName !== 'harshil')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  if (!body.reg_plate || !body.make || !body.company)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const vehicle = await createVehicle({ ...body, created_by: user.email })
  return NextResponse.json({ vehicle }, { status: 201 })
}
