# Pabari Connect — starter kit

Everything here is written to drop into the existing `pabari-tasklist` Next.js app with
minimal changes. It's a starting point for Claude Code (or you) to wire up against the
real repo — file paths, import aliases, and the `db` client below are best guesses and
will need adjusting to match your actual conventions.

## What's in here

```
migrations/001_pabari_connect.sql     — new tables (companies, contacts, categories,
                                          tags, notes, attachments, favorites, activity log)
scripts/import-legacy-contacts.js     — one-time import of pabari_contacts.xlsx (1,430 rows)
app/api/connect/contacts/route.ts     — GET (search/list) + POST (create) API route
app/connect/page.tsx                  — the Connect page itself (search, category tabs,
                                          tap-to-call confirmation — same UX as the
                                          standalone directory you've been using)
```

## Setup steps

1. **Run the migration** against your Railway Postgres instance:
   ```bash
   psql "$DATABASE_URL" -f migrations/001_pabari_connect.sql
   ```
   If pabari-tasklist uses Prisma, run `prisma db pull` afterward to generate matching
   model definitions in `schema.prisma` — the SQL above is plain Postgres so it works
   either way.

2. **Import your existing 1,430 contacts:**
   ```bash
   npm install pg xlsx
   DATABASE_URL="$DATABASE_URL" node scripts/import-legacy-contacts.js /path/to/pabari_contacts.xlsx
   ```
   This groups contacts by company automatically and auto-suggests a category for each
   (bank-name/gov-keyword matching, same logic as before) — anything it can't confidently
   categorize gets tagged `Other` for you to fix later, same spirit as the "Needs Review"
   flagging we did by hand.

3. **Add the nav item** — wherever the sidebar links live in the current app (something
   like `components/Sidebar.tsx`), add a `Connect` entry pointing at `/connect`.

4. **Fix the `db` import** in `app/api/connect/contacts/route.ts` — it currently assumes
   `import { db } from '@/lib/db'` exporting a `pg` Pool with a `.query()` method. Swap
   this for whatever pabari-tasklist actually uses (Prisma client, a different pool
   export, etc.).

5. **Auth/RBAC** — no new auth was written here; the route handlers assume they're
   already behind whatever middleware protects the rest of the app. If Connect should be
   restricted differently than Tasks/Approvals, that's a one-line check to add at the top
   of `route.ts`.

## What's intentionally left out (Phase 2+, per the module spec)

- Card image upload + OCR extraction flow (Claude vision call → review screen)
- Natural-language search ("find packaging suppliers in Kenya")
- Notes / attachments / favorites UI (tables exist in the migration, no UI yet)
- Dashboard widgets (Recently Viewed, Most Contacted, etc.)

These follow the same phased order as `pabari-connect-module-spec.md` — this kit covers
Phase 1 (Company + Contact CRUD, structured search, the 1,430 contacts live) so there's a
working module to build the rest on top of.
