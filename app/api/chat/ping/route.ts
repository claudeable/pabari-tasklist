import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Presence ping — kept for backwards compatibility, online panel removed
export async function POST() {
  return NextResponse.json({ ok: true })
}
