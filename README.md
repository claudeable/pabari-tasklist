# Pabari Group ERP — Task Management System

Built by Nexora. Full-stack Next.js 14 + Supabase.

---

## Setup (one time only)

### Step 1 — Install Node.js
Download from https://nodejs.org → click the LTS button → run installer → Next through everything.

### Step 2 — Open this folder in VS Code
File → Open Folder → select the `pabari-erp` folder

### Step 3 — Install dependencies
Open the terminal in VS Code (Ctrl + `) and run:
```
npm install
```
Wait for it to finish (about 1 minute).

### Step 4 — Set up Supabase (free database)
1. Go to https://supabase.com and create a free account
2. Click "New Project" — name it `pabari-erp`
3. Go to the SQL Editor (left sidebar)
4. Open the file `supabase-schema.sql` from this folder
5. Copy the entire contents and paste into the SQL Editor
6. Click "Run" — this creates all tables and seed data

### Step 5 — Add your Supabase keys
1. In Supabase go to Settings → API
2. Copy the "Project URL" and "anon public" key
3. Rename `.env.local.example` to `.env.local`
4. Paste your values in:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### Step 6 — Run the system
```
npm run dev
```
Open http://localhost:3000 in your browser.

---

## Deploy live (so the whole team can use it)

1. Push this folder to a GitHub repo
2. Go to https://vercel.com → New Project → import your repo
3. Add the same two environment variables from Step 5
4. Click Deploy — done. You'll get a live URL like `pabari-erp.vercel.app`

---

## File structure
```
pabari-erp/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Redirects to /tasks
│   ├── globals.css         # Global styles
│   ├── tasks/
│   │   └── page.tsx        # Main tasks page (fetches from Supabase)
│   └── api/tasks/
│       ├── route.ts        # POST /api/tasks (create)
│       └── [id]/
│           ├── route.ts    # PATCH/DELETE /api/tasks/:id
│           └── updates/
│               └── route.ts # POST /api/tasks/:id/updates
├── components/
│   └── TaskBoard.tsx       # Main UI component (entire ERP interface)
├── lib/
│   └── supabase.ts         # Supabase client
├── types/
│   └── index.ts            # TypeScript types
├── supabase-schema.sql     # Run this in Supabase SQL Editor
├── .env.local.example      # Rename to .env.local and add your keys
└── package.json
```
