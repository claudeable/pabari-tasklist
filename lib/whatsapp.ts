import { query, execute } from './database'

let colReady = false
async function ensurePhoneCol() {
  if (colReady) return
  await execute(`ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT NOT NULL DEFAULT ''`).catch(() => {})
  colReady = true
}

/** Look up a user's stored WhatsApp number by email */
export async function getPhoneByEmail(email: string): Promise<string | null> {
  try {
    await ensurePhoneCol()
    const rows = await query<{ whatsapp_phone: string }>(
      `SELECT whatsapp_phone FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    )
    const phone = rows[0]?.whatsapp_phone?.trim()
    return phone || null
  } catch { return null }
}

/** Save or update a user's WhatsApp number */
export async function savePhoneForUser(email: string, phone: string): Promise<void> {
  await ensurePhoneCol()
  // Normalise: strip spaces, ensure leading + for international
  const clean = phone.trim().replace(/\s+/g, '')
  await execute(
    `UPDATE users SET whatsapp_phone=$1 WHERE LOWER(email)=LOWER($2)`,
    [clean, email]
  )
}

/**
 * Send a WhatsApp template message.
 * Requires env vars:
 *   WHATSAPP_PHONE_NUMBER_ID  — e.g. 1245000995356701
 *   WHATSAPP_ACCESS_TOKEN     — long-lived token from Meta dashboard
 *   WHATSAPP_TEMPLATE_NAME    — approved template name, e.g. jaspers_market_order
 *   WHATSAPP_TEMPLATE_LANG    — language code, defaults to en_US
 *
 * The template must accept one body text parameter {{1}}.
 */
export async function sendWhatsApp(toPhone: string, bodyText: string): Promise<void> {
  const phoneId  = process.env.WHATSAPP_PHONE_NUMBER_ID
  const token    = process.env.WHATSAPP_ACCESS_TOKEN
  const template = process.env.WHATSAPP_TEMPLATE_NAME
  const lang     = process.env.WHATSAPP_TEMPLATE_LANG || 'en_US'

  if (!phoneId || !token || !template) {
    // WhatsApp not configured — silently skip
    return
  }

  // Strip leading + for Graph API (it expects E.164 without +)
  const phone = toPhone.replace(/^\+/, '').replace(/\s+/g, '')
  if (!phone) return

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone,
        type: 'template',
        template: {
          name: template,
          language: { code: lang },
          components: [{
            type: 'body',
            parameters: [{ type: 'text', text: bodyText.slice(0, 1024) }],
          }],
        },
      }),
    })
    if (!res.ok) {
      const txt = await res.text()
      console.error('[WhatsApp] send failed to', phone, ':', txt)
    }
  } catch (e) {
    console.error('[WhatsApp] network error:', e)
  }
}

/**
 * Convenience: look up phone by email then send — does nothing if no phone saved.
 */
export async function notifyByEmail(email: string, message: string): Promise<void> {
  const phone = await getPhoneByEmail(email)
  if (phone) await sendWhatsApp(phone, message)
}
