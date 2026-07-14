import { NextRequest, NextResponse } from 'next/server'
import { execute, query } from '@/lib/database'

export const dynamic = 'force-dynamic'

// ── Ensure delivery log table ────────────────────────────────────────────────
async function ensureLogTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS whatsapp_delivery_log (
      id          SERIAL PRIMARY KEY,
      message_id  TEXT,
      to_phone    TEXT,
      status      TEXT,
      error_code  TEXT,
      error_msg   TEXT,
      raw         JSONB,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {})
}

// ── GET — Meta webhook verification ─────────────────────────────────────────
// Meta sends: ?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get('hub.mode')
  const token     = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[WA Webhook] WHATSAPP_WEBHOOK_VERIFY_TOKEN not set')
    return new NextResponse('Webhook token not configured', { status: 500 })
  }

  if (mode === 'subscribe' && token === verifyToken) {
    console.log('[WA Webhook] Verified successfully')
    return new NextResponse(challenge, { status: 200 })
  }

  console.warn('[WA Webhook] Verification failed — token mismatch')
  return new NextResponse('Forbidden', { status: 403 })
}

// ── POST — Incoming messages & status updates from Meta ─────────────────────
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return new NextResponse('Bad Request', { status: 400 })
  }

  await ensureLogTable()

  try {
    const entries = (body.entry as Record<string, unknown>[]) ?? []

    for (const entry of entries) {
      const changes = (entry.changes as Record<string, unknown>[]) ?? []

      for (const change of changes) {
        const value = change.value as Record<string, unknown>
        if (!value) continue

        // ── Delivery / read status updates ───────────────────────────────────
        const statuses = (value.statuses as Record<string, unknown>[]) ?? []
        for (const s of statuses) {
          const msgId   = String(s.id ?? '')
          const phone   = String(s.recipient_id ?? '')
          const status  = String(s.status ?? '')   // sent | delivered | read | failed
          const errCode = s.errors ? String((s.errors as Record<string, unknown>[])[0]?.code ?? '') : ''
          const errMsg  = s.errors ? String((s.errors as Record<string, unknown>[])[0]?.message ?? '') : ''

          console.log(`[WA] ${status.toUpperCase()} → ${phone} (${msgId})${errCode ? ` ERR ${errCode}: ${errMsg}` : ''}`)

          await query(
            `INSERT INTO whatsapp_delivery_log (message_id, to_phone, status, error_code, error_msg, raw)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [msgId, phone, status, errCode, errMsg, JSON.stringify(s)]
          ).catch(() => {})

          // If failed, log to console so Railway logs capture it
          if (status === 'failed') {
            console.error(`[WA] Delivery FAILED to ${phone}: ${errCode} — ${errMsg}`)
          }
        }

        // ── Incoming messages (user replies) ─────────────────────────────────
        const messages = (value.messages as Record<string, unknown>[]) ?? []
        for (const msg of messages) {
          const fromPhone = String(msg.from ?? '')
          const msgType   = String(msg.type ?? '')
          const text      = msgType === 'text'
            ? String((msg.text as Record<string, unknown>)?.body ?? '')
            : `[${msgType}]`

          console.log(`[WA] Incoming from ${fromPhone}: ${text}`)

          // Look up user by phone and log it as activity
          try {
            const rows = await query<{ name: string; email: string }>(
              `SELECT name, email FROM users WHERE REPLACE(REPLACE(whatsapp_phone,' ',''),'+','') = $1 LIMIT 1`,
              [fromPhone.replace('+', '')]
            )
            if (rows[0]) {
              const { execute: exec } = await import('@/lib/database')
              await exec(
                `INSERT INTO activity_log (user_email, user_name, action, details) VALUES ($1,$2,$3,$4)`,
                [rows[0].email, rows[0].name, 'whatsapp_reply', `WhatsApp reply: ${text.slice(0, 200)}`]
              ).catch(() => {})
            }
          } catch { /* */ }
        }
      }
    }
  } catch (e) {
    console.error('[WA Webhook] Processing error:', e)
  }

  // Meta requires a 200 OK response quickly
  return NextResponse.json({ ok: true })
}
