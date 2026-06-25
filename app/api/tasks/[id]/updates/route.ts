import { NextRequest, NextResponse } from 'next/server'
import { addUpdate } from '@/lib/db'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const update = addUpdate(params.id, { date: body.date, text: body.text })
  if (!update) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  return NextResponse.json({ update })
}
