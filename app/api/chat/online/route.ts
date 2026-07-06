import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Online panel removed — kept for backwards compatibility
export async function GET() {
  return NextResponse.json({ users: [] })
}
