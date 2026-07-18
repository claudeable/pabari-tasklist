-- Pabari Connect — schema migration
-- Adds the Connect module tables to the existing Pabari ERP (pabari-tasklist) database.
-- Written as plain Postgres SQL so it works whether the app uses Prisma, raw pg, or
-- another data layer. If Prisma is in use, `prisma db pull` after running this will
-- generate matching model definitions in schema.prisma automatically.

BEGIN;

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_companies (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    industry        TEXT,
    country         TEXT,
    website         TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_connect_companies_name_lower
    ON connect_companies (LOWER(name));

-- ---------------------------------------------------------------------------
-- Categories (Banking, Government, Manufacturing, Beverage, Agriculture,
-- Logistics, Packaging, Construction, Technology, Energy, Insurance,
-- Hospitality, Other — seeded below)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_categories (
    id      SERIAL PRIMARY KEY,
    name    TEXT NOT NULL UNIQUE
);

INSERT INTO connect_categories (name) VALUES
    ('Banking'), ('Government'), ('Manufacturing'), ('Beverage'),
    ('Agriculture'), ('Logistics'), ('Packaging'), ('Construction'),
    ('Technology'), ('Energy'), ('Insurance'), ('Hospitality'),
    ('Legal'), ('Healthcare'), ('Travel & Hospitality'), ('Other')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS connect_company_categories (
    company_id  INTEGER NOT NULL REFERENCES connect_companies(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES connect_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (company_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Contacts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_contacts (
    id                  SERIAL PRIMARY KEY,
    company_id          INTEGER REFERENCES connect_companies(id) ON DELETE SET NULL,
    full_name           TEXT NOT NULL,
    position            TEXT,
    department          TEXT,
    phone               TEXT,
    phone_secondary     TEXT,
    email               TEXT,
    linkedin_url        TEXT,
    country             TEXT,
    address             TEXT,
    card_front_image_url TEXT,
    card_back_image_url  TEXT,
    source              TEXT NOT NULL DEFAULT 'manual',   -- manual | ocr-scan | imported-xlsx
    needs_review        BOOLEAN NOT NULL DEFAULT false,
    review_note         TEXT,
    duplicate_group     TEXT,                              -- links two records for the same person
    subsidiary_owner_id INTEGER,                            -- FK into existing subsidiaries table, nullable
    created_by          INTEGER,                            -- FK into existing users table
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_viewed_at       TIMESTAMPTZ,
    last_viewed_by       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_connect_contacts_company     ON connect_contacts (company_id);
CREATE INDEX IF NOT EXISTS idx_connect_contacts_name        ON connect_contacts (full_name);
CREATE INDEX IF NOT EXISTS idx_connect_contacts_country     ON connect_contacts (country);
CREATE INDEX IF NOT EXISTS idx_connect_contacts_needs_review ON connect_contacts (needs_review) WHERE needs_review = true;

-- Full-text search across the fields people actually search by
ALTER TABLE connect_contacts ADD COLUMN IF NOT EXISTS search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('simple', coalesce(full_name, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(position, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(email, '')), 'C') ||
        setweight(to_tsvector('simple', coalesce(country, '')), 'D')
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_connect_contacts_search ON connect_contacts USING GIN (search_vector);

CREATE TABLE IF NOT EXISTS connect_contact_categories (
    contact_id  INTEGER NOT NULL REFERENCES connect_contacts(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES connect_categories(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, category_id)
);

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_tags (
    id      SERIAL PRIMARY KEY,
    label   TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS connect_contact_tags (
    contact_id  INTEGER NOT NULL REFERENCES connect_contacts(id) ON DELETE CASCADE,
    tag_id      INTEGER NOT NULL REFERENCES connect_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (contact_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Notes (attach to either a contact or a company)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_notes (
    id          SERIAL PRIMARY KEY,
    contact_id  INTEGER REFERENCES connect_contacts(id) ON DELETE CASCADE,
    company_id  INTEGER REFERENCES connect_companies(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    author_id   INTEGER,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT connect_notes_target_chk CHECK (
        (contact_id IS NOT NULL)::int + (company_id IS NOT NULL)::int = 1
    )
);

-- ---------------------------------------------------------------------------
-- Attachments (PDFs, catalogues, quotations, contracts, meeting notes)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_attachments (
    id          SERIAL PRIMARY KEY,
    contact_id  INTEGER REFERENCES connect_contacts(id) ON DELETE CASCADE,
    company_id  INTEGER REFERENCES connect_companies(id) ON DELETE CASCADE,
    file_url    TEXT NOT NULL,
    file_type   TEXT,
    label       TEXT,
    uploaded_by INTEGER,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT connect_attachments_target_chk CHECK (
        (contact_id IS NOT NULL)::int + (company_id IS NOT NULL)::int = 1
    )
);

-- ---------------------------------------------------------------------------
-- Favorites (per-user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_favorites (
    user_id     INTEGER NOT NULL,
    contact_id  INTEGER NOT NULL REFERENCES connect_contacts(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, contact_id)
);

-- ---------------------------------------------------------------------------
-- Activity log (drives "Recently Viewed" and "Most Contacted Companies")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS connect_activity_log (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    contact_id  INTEGER REFERENCES connect_contacts(id) ON DELETE CASCADE,
    action      TEXT NOT NULL,   -- 'viewed' | 'called' | 'emailed'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_connect_activity_user_time ON connect_activity_log (user_id, created_at DESC);

COMMIT;
