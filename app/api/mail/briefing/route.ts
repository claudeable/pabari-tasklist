import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getMailAccount } from '@/lib/mail/zoho'
import { generateEmailBriefing } from '@/lib/mail/analyze'

export const dynamic = 'force-dynamic'

// GET /api/mail/briefing — generates an AI morning email briefing for the AI assistant
export async function GET() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const account = await getMailAccount(user.id)
  if (!account) return NextResponse.json({ connected: false, briefing: '' })

  const firstName = user.name.split(' ')[0]
  const briefing  = await generateEmailBriefing(user.id, firstName)

  return NextResponse.json({ connected: true, briefing })
}
