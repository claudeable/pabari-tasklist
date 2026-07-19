import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getAssets, createAsset } from '@/lib/db'

async function auth(req: NextRequest) {
  const token = req.cookies.get('fin-session')?.value
  return token ? verifyToken(token) : null
}

export async function GET(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = req.nextUrl
  const assets = await getAssets({
    company: searchParams.get('company') || undefined,
    type:    searchParams.get('type')    || undefined,
    status:  searchParams.get('status')  || undefined,
  })
  return NextResponse.json({ assets })
}

export async function POST(req: NextRequest) {
  const user = await auth(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  if (!body.asset_no || !body.name || !body.company)
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  const asset = await createAsset({ ...body, created_by: user.email })
  return NextResponse.json({ asset }, { status: 201 })
}
