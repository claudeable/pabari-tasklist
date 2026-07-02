// node scripts/init-db.js
// Creates tables and seeds data on first deploy. Safe to re-run.
const { Pool } = require('pg')
const bcrypt   = require('bcryptjs')
const { randomUUID } = require('crypto')
const fs   = require('fs')
const path = require('path')

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.')
  console.error('Add a PostgreSQL service in Railway and link DATABASE_URL to this service.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
})

const USERS = [
  { name: 'Admin',       email: 'admin@usm.co.ke',           role: 'admin'    },
  { name: 'Pedro',       email: 'hpedro@usc.co.ke',          role: 'staff'    },
  { name: 'Harshil',     email: 'hkotecha@kwale-group.com',  role: 'director' },
  { name: 'Sabina',      email: 'smutua@kwale-group.com',    role: 'manager'  },
  { name: 'Ahmad',       email: 'ahmad@usc.co.ke',           role: 'manager'  },
  { name: 'Eng. Suresh', email: 'ssuresh@kwale-group.com',   role: 'manager'  },
  { name: 'Paul',        email: 'pmureithi@usm.co.ke',       role: 'manager'  },
  { name: 'Krishina',    email: 'rkrishnan@usm.co.ke',       role: 'manager'  },
  { name: 'Ashok',       email: 'sashok@usm.co.ke',          role: 'manager'  },
  { name: 'Yalelet',     email: 'yaynalem@usm.co.ke',        role: 'staff'    },
  { name: 'Andu',        email: 'andu@usc.co.ke',            role: 'staff'    },
  { name: 'Yared',       email: 'yyigezu@usm.co.ke',         role: 'staff'    },
  { name: 'Benson',      email: 'benson@usc.co.ke',          role: 'manager'  },
  { name: 'Simon',       email: 'sithibu@kwale-group.com',   role: 'staff'    },
  { name: 'Binal',       email: 'binal@usc.co.ke',           role: 'manager'  },
  { name: 'Mungai',      email: 'mungai@usc.co.ke',          role: 'manager'  },
  { name: 'Lazarus',     email: 'lazarus@usc.co.ke',         role: 'manager'  },
]

// Email changes: old placeholder → real email (for users already in the DB)
const EMAIL_MIGRATIONS = [
  { from: 'harshil@usc.co.ke',  to: 'hkotecha@kwale-group.com' },
  { from: 'sabina@usc.co.ke',   to: 'smutua@kwale-group.com'   },
  { from: 'suresh@usc.co.ke',   to: 'ssuresh@kwale-group.com'  },
  { from: 'paul@usc.co.ke',     to: 'pmureithi@usm.co.ke'      },
  { from: 'krishnan@usc.co.ke', to: 'rkrishnan@usm.co.ke'      },
  { from: 'ashok@usc.co.ke',    to: 'sashok@usm.co.ke'         },
  { from: 'yalelet@usc.co.ke',  to: 'yaynalem@usm.co.ke'       },
  { from: 'yared@usc.co.ke',    to: 'yyigezu@usm.co.ke'        },
  { from: 'simon@usc.co.ke',    to: 'sithibu@kwale-group.com'  },
]

async function waitForDb(retries = 10, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const client = await pool.connect()
      client.release()
      console.log('✓ Connected to PostgreSQL')
      return
    } catch (err) {
      console.log(`Waiting for database... attempt ${i}/${retries}`)
      if (i === retries) throw err
      await new Promise(r => setTimeout(r, delayMs))
    }
  }
}

async function main() {
  await waitForDb()
  const client = await pool.connect()
  try {
    // ── Create tables ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(255) UNIQUE NOT NULL,
        role          VARCHAR(20)  NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at    TIMESTAMPTZ  DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id          SERIAL PRIMARY KEY,
        sno         INTEGER,
        date        VARCHAR(50),
        company     VARCHAR(100) NOT NULL,
        category    VARCHAR(100),
        section     VARCHAR(200),
        particulars TEXT        NOT NULL,
        updates     TEXT,
        responsible VARCHAR(200),
        payment     VARCHAR(100),
        status      VARCHAR(50)  DEFAULT 'pending-discussion',
        status_wk   TEXT,
        hk_comment  TEXT,
        created_at  TIMESTAMPTZ  DEFAULT NOW(),
        updated_at  TIMESTAMPTZ  DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS task_updates (
        id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id    INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        date       VARCHAR(50),
        text       TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name         VARCHAR(255) NOT NULL,
        generated_by VARCHAR(100) NOT NULL,
        filters      JSONB DEFAULT '{}',
        task_count   INTEGER DEFAULT 0,
        created_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `)

    // ── Migrations: add columns to existing tables safely ────────────────────
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'`)

    // ── Remove KISCOL (moved to its own standalone ERP) ───────────────────────
    const { rows: [{ count: kiscolCount }] } = await client.query(`SELECT COUNT(*) FROM tasks WHERE company = 'KISCOL'`)
    if (parseInt(kiscolCount) > 0) {
      await client.query(`DELETE FROM tasks WHERE company = 'KISCOL'`)
      console.log(`✓ Removed ${kiscolCount} KISCOL tasks`)
    }

    // ── Indexes ──────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_company    ON tasks(company)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status     ON tasks(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON tasks(responsible)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id)`)

    console.log('✓ Tables and indexes ready')

    // ── Migrate old placeholder emails to real emails ────────────────────────
    for (const m of EMAIL_MIGRATIONS) {
      const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) FROM users WHERE email = $1`, [m.from])
      if (parseInt(count) > 0) {
        await client.query(`UPDATE users SET email = $1 WHERE email = $2`, [m.to, m.from])
        console.log(`✓ Updated email ${m.from} → ${m.to}`)
      }
    }

    // ── Seed users (upsert — update role/name, never overwrite password) ─────
    const hash = await bcrypt.hash('changeme123', 10)
    for (const u of USERS) {
      await client.query(`
        INSERT INTO users (id, name, email, role, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO UPDATE
          SET name = EXCLUDED.name,
              role = EXCLUDED.role
      `, [randomUUID(), u.name, u.email, u.role, hash])
    }
    console.log(`✓ Upserted ${USERS.length} users`)

    // ── Seed tasks (only if table is empty) ───────────────────────────────────
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM tasks')
    if (parseInt(count) === 0) {
      const tasksFile = path.join(__dirname, '..', 'data', 'tasks.json')
      if (fs.existsSync(tasksFile)) {
        const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'))
        for (const t of tasks) {
          // Let PostgreSQL assign IDs via SERIAL — no explicit id to avoid duplicates
          const { rows: [inserted] } = await client.query(`
            INSERT INTO tasks (sno, date, company, category, section, particulars,
              updates, responsible, payment, status, status_wk, hk_comment, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
            RETURNING id
          `, [
            t.sno || 0, t.date || '', t.company, t.category || '',
            t.section || '', t.particulars, t.updates || '', t.responsible || '',
            t.payment || 'Non-Payment', t.status || 'pending-discussion',
            t.status_wk || '', t.hk_comment || '',
            t.created_at || new Date().toISOString(),
            t.updated_at || new Date().toISOString(),
          ])

          // Seed task_updates using the new auto-assigned task ID
          if (Array.isArray(t.task_updates) && t.task_updates.length > 0) {
            for (const u of t.task_updates) {
              await client.query(`
                INSERT INTO task_updates (task_id, date, text, created_at)
                VALUES ($1,$2,$3,$4)
              `, [inserted.id, u.date || '', u.text || '', u.created_at || new Date().toISOString()])
            }
          }
        }
        console.log(`✓ Seeded ${tasks.length} tasks from tasks.json`)
      }
    } else {
      console.log(`✓ Tasks table already has ${count} rows — skipping seed`)
    }

    console.log('✓ Database initialization complete')
  } finally {
    client.release()
    await pool.end()
  }
}

main().catch(err => {
  console.error('Database init failed:', err.message)
  process.exit(1)
})
