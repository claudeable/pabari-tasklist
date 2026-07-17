import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Mail accounts — one per user per provider
    await execute(`
      CREATE TABLE IF NOT EXISTS mail_accounts (
        id                    SERIAL PRIMARY KEY,
        user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider              TEXT    NOT NULL DEFAULT 'zoho',
        account_email         TEXT    NOT NULL,
        zoho_account_id       TEXT,
        data_center           TEXT    NOT NULL DEFAULT 'com',
        access_token_enc      TEXT    NOT NULL,
        refresh_token_enc     TEXT    NOT NULL,
        token_expiry          TIMESTAMPTZ,
        scope                 TEXT,
        connected_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_sync_at          TIMESTAMPTZ,
        last_sync_folder_id   TEXT,
        sync_status           TEXT    NOT NULL DEFAULT 'active',
        error_message         TEXT,
        UNIQUE(user_id, provider)
      )
    `)

    // Emails — metadata only, no full body stored long-term
    await execute(`
      CREATE TABLE IF NOT EXISTS mail_emails (
        id                SERIAL PRIMARY KEY,
        account_id        INTEGER NOT NULL REFERENCES mail_accounts(id) ON DELETE CASCADE,
        zoho_message_id   TEXT    NOT NULL,
        zoho_thread_id    TEXT,
        from_email        TEXT,
        from_name         TEXT,
        to_emails         TEXT[],
        subject           TEXT    NOT NULL DEFAULT '(no subject)',
        snippet           TEXT,
        received_at       TIMESTAMPTZ,
        is_read           BOOLEAN NOT NULL DEFAULT false,
        is_archived       BOOLEAN NOT NULL DEFAULT false,
        is_deleted        BOOLEAN NOT NULL DEFAULT false,
        has_attachments   BOOLEAN NOT NULL DEFAULT false,
        folder            TEXT    NOT NULL DEFAULT 'INBOX',
        zoho_folder_id    TEXT,
        fetched_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(account_id, zoho_message_id)
      )
    `)
    await execute(`CREATE INDEX IF NOT EXISTS mail_emails_account_received ON mail_emails(account_id, received_at DESC)`)
    await execute(`CREATE INDEX IF NOT EXISTS mail_emails_account_read ON mail_emails(account_id, is_read, is_archived)`)

    // AI analysis — one per email
    await execute(`
      CREATE TABLE IF NOT EXISTS mail_email_analysis (
        id                  SERIAL PRIMARY KEY,
        email_id            INTEGER NOT NULL REFERENCES mail_emails(id) ON DELETE CASCADE UNIQUE,
        priority            TEXT    CHECK (priority IN ('Critical','High','Medium','Low')),
        category            TEXT,
        requires_action     BOOLEAN NOT NULL DEFAULT false,
        deadline            TEXT,
        summary             TEXT,
        recommended_action  TEXT,
        analysed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
        model_version       TEXT    NOT NULL DEFAULT 'claude-haiku-4-5'
      )
    `)

    // Email labels (free-form tags)
    await execute(`
      CREATE TABLE IF NOT EXISTS mail_email_labels (
        id          SERIAL PRIMARY KEY,
        email_id    INTEGER NOT NULL REFERENCES mail_emails(id) ON DELETE CASCADE,
        label       TEXT    NOT NULL,
        UNIQUE(email_id, label)
      )
    `)

    // Email → ERP task links
    await execute(`
      CREATE TABLE IF NOT EXISTS mail_email_tasks (
        id          SERIAL PRIMARY KEY,
        email_id    INTEGER NOT NULL REFERENCES mail_emails(id) ON DELETE CASCADE,
        task_id     INTEGER NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_by  INTEGER REFERENCES users(id),
        UNIQUE(email_id, task_id)
      )
    `)

    // Notification queue for critical emails
    await execute(`
      CREATE TABLE IF NOT EXISTS mail_notification_queue (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email_id    INTEGER NOT NULL REFERENCES mail_emails(id) ON DELETE CASCADE,
        type        TEXT    NOT NULL DEFAULT 'email_critical',
        title       TEXT,
        body        TEXT,
        href        TEXT,
        is_read     BOOLEAN NOT NULL DEFAULT false,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await execute(`CREATE INDEX IF NOT EXISTS mail_notif_user_unread ON mail_notification_queue(user_id, is_read, created_at DESC)`)

    return NextResponse.json({ ok: true, message: 'Mail tables created' })
  } catch (e) {
    console.error('[mail/migrate]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
