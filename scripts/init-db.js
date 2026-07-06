// node scripts/init-db.js
// Creates tables and seeds data on first deploy. Safe to re-run.
const { Pool } = require('pg')
const bcrypt   = require('bcryptjs')
const { randomUUID } = require('crypto')
const fs   = require('fs')
const path = require('path')

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set.')
  process.exit(1)
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
})

// ── All 21 users with departments and reporting lines ─────────────────────────
const USERS = [
  // companies: ['ALL'] = sees all companies; ['KISCOL'] = KISCOL only
  { name: 'Admin',       email: 'admin@usm.co.ke',          role: 'admin',    department: 'System',                  reports_to: '',                        companies: ['ALL']     },
  { name: 'Harshil',    email: 'hkotecha@kwale-group.com', role: 'director', department: 'Director',                reports_to: '',                        companies: ['ALL']     },
  { name: 'Paul',       email: 'pmureithi@usm.co.ke',      role: 'director', department: 'Operations / AOB',                   reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Sabina',     email: 'smutua@kwale-group.com',   role: 'staff',    department: 'KISCOL',                            reports_to: 'ahmad@usm.co.ke',          companies: ['KISCOL']  },
  { name: 'Ashok',      email: 'sashok@usm.co.ke',         role: 'director', department: 'International Business & Operations', reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Andu',       email: 'ateferi@kwale-group.com',  role: 'director', department: 'Accounts',                          reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Yared',      email: 'yyigezu@usm.co.ke',        role: 'staff',    department: 'Accounts',                          reports_to: 'ateferi@kwale-group.com',  companies: ['ALL']     },
  { name: 'Yalelet',    email: 'yaynalem@usm.co.ke',       role: 'staff',    department: 'KISCOL',                            reports_to: 'ahmad@usm.co.ke',          companies: ['KISCOL']  },
  { name: 'Lulie',      email: 'laynalem@usm.co.ke',       role: 'staff',    department: 'Accounts',                          reports_to: 'ateferi@kwale-group.com',  companies: ['ALL']     },
  { name: 'Duran',      email: 'dligaga@usm.co.ke',        role: 'staff',    department: 'Accounts',                          reports_to: 'ateferi@kwale-group.com',  companies: ['ALL']     },
  { name: 'Juma',       email: 'johasa@usm.co.ke',         role: 'staff',    department: 'Accounts',                          reports_to: 'ateferi@kwale-group.com',  companies: ['ALL']     },
  { name: 'Benson',     email: 'benson@usm.co.ke',         role: 'director', department: 'Group CEO',                          reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'David Kulecho', email: 'dkulecho@kwale-group.com', role: 'director', department: 'Legal',                          reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Ahmad',      email: 'ahmad@usm.co.ke',          role: 'director', department: 'KISCOL',                            reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Eng. Suresh',email: 'ssuresh@kwale-group.com',  role: 'director', department: 'Projects',                          reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Mungai',     email: 'mungai@usm.co.ke',         role: 'manager',  department: 'Logistics',                         reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Binal',      email: 'bpabari@usm.co.ke',        role: 'director', department: 'GHPL',                              reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Krishina',   email: 'rkrishnan@usm.co.ke',      role: 'director', department: 'Trading',                           reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Lazarus',    email: 'lazarus@usm.co.ke',        role: 'manager',  department: 'Administration',                    reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Simon',      email: 'sithibu@kwale-group.com',  role: 'staff',    department: 'Administration',                    reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Pedro',      email: 'hpedro@usm.co.ke',         role: 'manager',  department: 'IT',                                reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'Duncan',     email: 'dmumo@usm.co.ke',          role: 'staff',    department: 'Administration',                    reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
  { name: 'James',      email: 'joduor@usm.co.ke',         role: 'manager',  department: 'HR',                                reports_to: 'hkotecha@kwale-group.com', companies: ['ALL']     },
]

// Old placeholder emails → real emails
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
  { from: 'andu@usc.co.ke',     to: 'ateferi@kwale-group.com'  },
  { from: 'binal@usc.co.ke',    to: 'bpabari@usm.co.ke'        },
  { from: 'benson@usc.co.ke',   to: 'benson@usm.co.ke'         },
  { from: 'ahmad@usc.co.ke',    to: 'ahmad@usm.co.ke'          },
  { from: 'mungai@usc.co.ke',   to: 'mungai@usm.co.ke'         },
  { from: 'lazarus@usc.co.ke',  to: 'lazarus@usm.co.ke'        },
  { from: 'hpedro@usc.co.ke',   to: 'hpedro@usm.co.ke'         },
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
        department    VARCHAR(100) DEFAULT '',
        reports_to    VARCHAR(255) DEFAULT '',
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
        hod_comment TEXT,
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
      CREATE TABLE IF NOT EXISTS task_audit (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        task_id     INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
        changed_by  VARCHAR(100) NOT NULL,
        action      VARCHAR(20)  NOT NULL,
        field       VARCHAR(100),
        old_value   TEXT,
        new_value   TEXT,
        changed_at  TIMESTAMPTZ  DEFAULT NOW()
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

    // ── Column migrations (safe to re-run) ───────────────────────────────────
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority        VARCHAR(20)  DEFAULT 'medium'`)
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date        DATE`)
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence      VARCHAR(20)  DEFAULT 'none'`)
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS hod_comment     TEXT`)
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_type   VARCHAR(50)  DEFAULT ''`)
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50)  DEFAULT ''`)
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by     VARCHAR(255) DEFAULT ''`)
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS department      VARCHAR(100) DEFAULT ''`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reports_to      VARCHAR(255) DEFAULT ''`)
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS companies       JSONB        DEFAULT '["ALL"]'`)

    // ── Indexes ──────────────────────────────────────────────────────────────
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_company     ON tasks(company)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_responsible ON tasks(responsible)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_updates_task ON task_updates(task_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_task_audit_task   ON task_audit(task_id)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_users_reports_to  ON users(reports_to)`)

    console.log('✓ Tables, columns and indexes ready')

    // ── Migrate old placeholder emails → real emails ──────────────────────────
    for (const m of EMAIL_MIGRATIONS) {
      const { rows: [{ count }] } = await client.query(`SELECT COUNT(*) FROM users WHERE email = $1`, [m.from])
      if (parseInt(count) > 0) {
        await client.query(`UPDATE users SET email = $1 WHERE email = $2`, [m.to, m.from])
        console.log(`✓ Email migrated: ${m.from} → ${m.to}`)
      }
    }

    // ── Upsert all users (name/role/dept/reports_to; never overwrites password) ─
    const hash = await bcrypt.hash('changeme123', 10)
    for (const u of USERS) {
      await client.query(`
        INSERT INTO users (id, name, email, role, department, reports_to, companies, password_hash)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (email) DO UPDATE
          SET name       = EXCLUDED.name,
              role       = EXCLUDED.role,
              department = EXCLUDED.department,
              reports_to = EXCLUDED.reports_to,
              companies  = EXCLUDED.companies
      `, [randomUUID(), u.name, u.email, u.role, u.department, u.reports_to, JSON.stringify(u.companies), hash])
    }
    console.log(`✓ Upserted ${USERS.length} users`)

    // ── Seed tasks (only if table is empty) ───────────────────────────────────
    const { rows: [{ count }] } = await client.query('SELECT COUNT(*) FROM tasks')
    if (parseInt(count) === 0) {
      const tasksFile = path.join(__dirname, '..', 'data', 'tasks.json')
      if (fs.existsSync(tasksFile)) {
        const tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'))
        for (const t of tasks) {
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
      console.log(`✓ Tasks table already has ${count} rows — skipping full seed`)
    }

    // ── Re-seed KISCOL tasks if missing (safe — only runs when count = 0) ─────
    const KISCOL_SECTION_MAP = {
      'EXTERNAL STAKEHOLDERS - NON-PAYMENT PENDING LIST': 'External Stakeholders - Non-Payment',
      'EXTERNAL STAKEHOLDERS - PAYMENT PENDING LIST':     'External Stakeholders - Payment',
      'OUTGROWERS FOLLOW-UPS':                            'Outgrowers',
      'STAFF - SALARY FOLLOW-UPS':                        'Staff - Salary',
      'STAFF - NON-SALARY':                               'Staff - Non-Salary',
      'PUT ON HOLD':                                      'Put on Hold',
    }
    const { rows: [{ count: kiscolCount }] } = await client.query(`SELECT COUNT(*) FROM tasks WHERE company = 'KISCOL'`)
    if (parseInt(kiscolCount) === 0) {
      const tasksFile = path.join(__dirname, '..', 'data', 'tasks.json')
      if (fs.existsSync(tasksFile)) {
        const allTasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'))
        const kiscolTasks = allTasks.filter(t => t.company === 'KISCOL')
        for (const t of kiscolTasks) {
          await client.query(`
            INSERT INTO tasks (sno, date, company, category, section, particulars,
              updates, responsible, payment, status, status_wk, hk_comment, created_at, updated_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
          `, [
            t.sno || 0, t.date || '', t.company, t.category || '',
            KISCOL_SECTION_MAP[t.section] || t.section || '', t.particulars, t.updates || '', t.responsible || '',
            t.payment || 'Non-Payment', t.status || 'pending-discussion',
            t.status_wk || '', t.hk_comment || '',
            t.created_at || new Date().toISOString(),
            t.updated_at || new Date().toISOString(),
          ])
        }
        console.log(`✓ Re-seeded ${kiscolTasks.length} KISCOL tasks`)
      }
    } else {
      console.log(`✓ KISCOL already has ${kiscolCount} tasks — skipping`)
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
