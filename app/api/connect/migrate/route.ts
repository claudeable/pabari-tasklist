import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { execute } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    // Companies
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_companies (
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        industry   TEXT,
        country    TEXT,
        website    TEXT,
        notes      TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_connect_companies_name_lower
        ON connect_companies (LOWER(name))
    `)

    // Categories
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_categories (
        id   SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
      )
    `)
    await execute(`
      INSERT INTO connect_categories (name) VALUES
        ('Banking'), ('Government'), ('Manufacturing'), ('Beverage'),
        ('Agriculture'), ('Logistics'), ('Packaging'), ('Construction'),
        ('Technology'), ('Energy'), ('Insurance'), ('Hospitality'),
        ('Legal'), ('Healthcare'), ('Travel & Hospitality'), ('Other')
      ON CONFLICT (name) DO NOTHING
    `)
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_company_categories (
        company_id  INTEGER NOT NULL REFERENCES connect_companies(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES connect_categories(id) ON DELETE CASCADE,
        PRIMARY KEY (company_id, category_id)
      )
    `)

    // Contacts
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_contacts (
        id                   SERIAL PRIMARY KEY,
        company_id           INTEGER REFERENCES connect_companies(id) ON DELETE SET NULL,
        full_name            TEXT NOT NULL,
        position             TEXT,
        department           TEXT,
        phone                TEXT,
        phone_secondary      TEXT,
        email                TEXT,
        linkedin_url         TEXT,
        country              TEXT,
        address              TEXT,
        card_front_image_url TEXT,
        card_back_image_url  TEXT,
        source               TEXT NOT NULL DEFAULT 'manual',
        needs_review         BOOLEAN NOT NULL DEFAULT false,
        review_note          TEXT,
        duplicate_group      TEXT,
        subsidiary_owner_id  INTEGER,
        created_by           INTEGER,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_viewed_at       TIMESTAMPTZ,
        last_viewed_by       INTEGER
      )
    `)
    await execute(`CREATE INDEX IF NOT EXISTS idx_connect_contacts_company ON connect_contacts (company_id)`)
    await execute(`CREATE INDEX IF NOT EXISTS idx_connect_contacts_name ON connect_contacts (full_name)`)
    await execute(`CREATE INDEX IF NOT EXISTS idx_connect_contacts_country ON connect_contacts (country)`)
    await execute(`
      ALTER TABLE connect_contacts ADD COLUMN IF NOT EXISTS search_vector tsvector
        GENERATED ALWAYS AS (
          setweight(to_tsvector('simple', coalesce(full_name, '')), 'A') ||
          setweight(to_tsvector('simple', coalesce(position, '')), 'B') ||
          setweight(to_tsvector('simple', coalesce(email, '')), 'C') ||
          setweight(to_tsvector('simple', coalesce(country, '')), 'D')
        ) STORED
    `.trim()).catch(() => {}) // ignore if already exists
    await execute(`CREATE INDEX IF NOT EXISTS idx_connect_contacts_search ON connect_contacts USING GIN (search_vector)`)
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_contact_categories (
        contact_id  INTEGER NOT NULL REFERENCES connect_contacts(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES connect_categories(id) ON DELETE CASCADE,
        PRIMARY KEY (contact_id, category_id)
      )
    `)

    // Tags, Notes, Attachments, Favorites, Activity (Phase 2 tables — create now, use later)
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_tags (
        id    SERIAL PRIMARY KEY,
        label TEXT NOT NULL UNIQUE
      )
    `)
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_contact_tags (
        contact_id  INTEGER NOT NULL REFERENCES connect_contacts(id) ON DELETE CASCADE,
        tag_id      INTEGER NOT NULL REFERENCES connect_tags(id) ON DELETE CASCADE,
        PRIMARY KEY (contact_id, tag_id)
      )
    `)
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_notes (
        id         SERIAL PRIMARY KEY,
        contact_id INTEGER REFERENCES connect_contacts(id) ON DELETE CASCADE,
        company_id INTEGER REFERENCES connect_companies(id) ON DELETE CASCADE,
        body       TEXT NOT NULL,
        author_id  INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_favorites (
        user_id    INTEGER NOT NULL,
        contact_id INTEGER NOT NULL REFERENCES connect_contacts(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, contact_id)
      )
    `)
    await execute(`
      CREATE TABLE IF NOT EXISTS connect_activity_log (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL,
        contact_id INTEGER REFERENCES connect_contacts(id) ON DELETE CASCADE,
        action     TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `)

    return NextResponse.json({ ok: true, message: 'Pabari Connect tables created successfully' })
  } catch (e) {
    console.error('[connect/migrate]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
