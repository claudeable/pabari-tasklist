import nodemailer from 'nodemailer'

const FROM = process.env.EMAIL_FROM || `Pabari Group ERP <${process.env.GMAIL_USER}>`

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendEmail({
  to, subject, body,
}: {
  to: string
  subject: string
  body: string
}): Promise<void> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[email] GMAIL_USER or GMAIL_APP_PASSWORD not set — skipping')
    return
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px">
        <tr><td align="center">
          <table width="100%" style="max-width:560px;background:white;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
            <tr>
              <td style="background:#1a3a2a;padding:18px 28px">
                <span style="background:#b5833a;color:white;font-weight:800;font-size:11px;padding:4px 10px;border-radius:3px;letter-spacing:1px">PABARI</span>
                <span style="color:white;font-size:14px;font-weight:600;margin-left:10px">PABARI GROUP</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px">
                <div style="font-size:14px;color:#374151;line-height:1.7;white-space:pre-line">${body.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb">
                <p style="margin:0;font-size:11px;color:#9ca3af">This is an automated notification from the Pabari Group ERP system. Please do not reply to this email.</p>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `

  const transporter = createTransport()
  await transporter.sendMail({ from: FROM, to, subject, html })
  console.log(`[email] sent to ${to}: ${subject}`)
}

export async function sendLeaveNotification({
  to, toName, subject, body,
}: {
  to: string
  toName: string
  subject: string
  body: string
}): Promise<void> {
  if (!to || !to.includes('@')) return
  await sendEmail({ to, subject, body }).catch(err =>
    console.error(`[email] failed to send to ${toName} (${to}):`, err.message)
  )
}
