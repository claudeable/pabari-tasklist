import { query, queryOne, execute } from './database'
import { Task, TaskUpdate, TaskPriority, Recurrence } from '@/types'

let parentColReady = false
async function ensureParentId() {
  if (parentColReady) return
  await execute('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id INTEGER')
  await execute('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS legal_review BOOLEAN NOT NULL DEFAULT false')
  await execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS legal_comment TEXT NOT NULL DEFAULT ''")
  await execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT ''")
  // Backfill created_by for tasks created before this column existed,
  // by matching each task's created_at against the activity_log task_created entry
  // within a 30-second window (they are logged in the same request).
  await execute(`
    UPDATE tasks t
    SET created_by = al.user_name
    FROM activity_log al
    WHERE al.action = 'task_created'
      AND t.created_by = ''
      AND ABS(EXTRACT(EPOCH FROM (t.created_at - al.created_at))) < 30
  `).catch(() => {})
  // Permanently delete all KISCOL tasks (company removed from system)
  await execute("DELETE FROM tasks WHERE company = 'KISCOL'").catch(() => {})
  // Create S. Kumar account if it doesn't exist (admin has no UI access to create users)
  const skumarExists = await queryOne('SELECT id FROM users WHERE email = $1', ['skumar@usm.co.ke']).catch(() => null)
  if (!skumarExists) {
    const bcrypt = await import('bcryptjs')
    const hash = await bcrypt.hash('Welcome2025!', 10)
    await execute(
      `INSERT INTO users (name, email, role, department, reports_to, hod_email, companies, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (email) DO NOTHING`,
      ['S. Kumar', 'skumar@usm.co.ke', 'staff', 'Operations', '', '', '["ALL"]', hash]
    ).catch(() => {})
  }

  // ── Multi-portal hub SSO ──────────────────────────────────────────────────
  // portals: which sub-portals each user can access ('pil', 'smartops', 'property')
  await execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS portals TEXT[] NOT NULL DEFAULT '{}'").catch(() => {})
  // sso_tokens: short-lived one-time tokens for cross-portal login
  await execute(`
    CREATE TABLE IF NOT EXISTS sso_tokens (
      id         SERIAL PRIMARY KEY,
      token      TEXT    NOT NULL UNIQUE,
      email      TEXT    NOT NULL,
      name       TEXT    NOT NULL,
      role       TEXT    NOT NULL,
      portal     TEXT    NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at    TIMESTAMPTZ
    )
  `).catch(() => {})
  // Clean up expired tokens on every boot
  await execute(`DELETE FROM sso_tokens WHERE expires_at < NOW() - INTERVAL '1 hour'`).catch(() => {})
  // ─────────────────────────────────────────────────────────────────────────

  parentColReady = true
}

function rowToTask(row: Record<string, unknown>): Task {
  const updates = Array.isArray(row.task_updates) ? row.task_updates : []
  return {
    id:           String(row.id),
    sno:          Number(row.sno) || 0,
    date:         String(row.date || ''),
    company:      String(row.company || ''),
    category:     String(row.category || ''),
    section:      String(row.section || ''),
    particulars:  String(row.particulars || ''),
    updates:      String(row.updates || ''),
    responsible:  String(row.responsible || ''),
    payment:      (row.payment as Task['payment']) || 'Non-Payment',
    status:          (row.status as Task['status']) || 'pending-discussion',
    priority:        (row.priority as TaskPriority) || 'medium',
    approval_type:   (row.approval_type as Task['approval_type']) || '',
    approval_status: String(row.approval_status || ''),
    approved_by:     String(row.approved_by || ''),
    approved_at:     String(row.approved_at || ''),
    status_wk:       String(row.status_wk || ''),
    hk_comment:      String(row.hk_comment || ''),
    hod_comment:     String(row.hod_comment || ''),
    due_date:        row.due_date ? String(row.due_date).slice(0, 10) : '',
    recurrence:      (row.recurrence as Recurrence) || 'none',
    parent_id:       row.parent_id ? String(row.parent_id) : undefined,
    legal_review:    Boolean(row.legal_review),
    legal_comment:   String(row.legal_comment || ''),
    created_by:      String(row.created_by || ''),
    created_at:   String(row.created_at || ''),
    updated_at:   String(row.updated_at || ''),
    task_updates: (updates as Record<string, unknown>[]).map(u => ({
      id:         String(u.id),
      task_id:    String(u.task_id),
      date:       String(u.date || ''),
      text:       String(u.text || ''),
      created_at: String(u.created_at || ''),
    })) as TaskUpdate[],
  }
}

const TASK_SELECT = `
  SELECT t.*,
    COALESCE(
      json_agg(
        json_build_object('id', tu.id, 'task_id', tu.task_id, 'date', tu.date, 'text', tu.text, 'created_at', tu.created_at)
        ORDER BY tu.created_at DESC
      ) FILTER (WHERE tu.id IS NOT NULL),
      '[]'
    ) AS task_updates
  FROM tasks t
  LEFT JOIN task_updates tu ON tu.task_id = t.id
`

export async function getTasks(): Promise<Task[]> {
  await ensureParentId()
  const rows = await query<Record<string, unknown>>(
    `${TASK_SELECT} GROUP BY t.id ORDER BY t.id`
  )
  return rows.map(rowToTask)
}

export async function getTaskById(id: string): Promise<Task | undefined> {
  const row = await queryOne<Record<string, unknown>>(
    `${TASK_SELECT} WHERE t.id = $1 GROUP BY t.id`,
    [id]
  )
  return row ? rowToTask(row) : undefined
}

export async function createTask(
  data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'task_updates' | 'legal_comment'>
): Promise<Task> {
  await ensureParentId()
  const now = new Date().toISOString()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO tasks (sno, date, company, category, section, particulars, updates,
       responsible, payment, status, priority, approval_type, status_wk, hk_comment,
       due_date, recurrence, parent_id, legal_review, project_id, created_at, updated_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [data.sno, data.date, data.company, data.category, data.section, data.particulars,
     data.updates, data.responsible, data.payment, data.status, data.priority ?? 'medium',
     data.approval_type ?? '', data.status_wk, data.hk_comment,
     data.due_date || null, data.recurrence || 'none',
     data.parent_id ? Number(data.parent_id) : null,
     data.legal_review ?? false,
     data.project_id ? Number(data.project_id) : null,
     now, now, data.created_by ?? '']
  )
  if (!row) throw new Error('Failed to create task')
  return rowToTask({ ...row, task_updates: [] })
}

const AUDIT_FIELDS = new Set([
  'status', 'priority', 'hk_comment', 'hod_comment', 'status_wk', 'responsible',
  'section', 'category', 'particulars', 'date', 'company', 'payment',
  'approval_type', 'approval_status', 'approved_by', 'due_date', 'recurrence', 'legal_review',
])

export async function updateTask(id: string, updates: Partial<Task>, changedBy = 'System'): Promise<Task | null> {
  const allowed = ['status', 'priority', 'hk_comment', 'hod_comment', 'updates', 'responsible',
                   'section', 'category', 'particulars', 'date', 'company', 'payment', 'status_wk',
                   'approval_type', 'approval_status', 'approved_by', 'approved_at',
                   'due_date', 'recurrence', 'legal_review', 'legal_comment', 'project_id']
  const fields = Object.keys(updates).filter(k => allowed.includes(k))
  if (fields.length === 0) return (await getTaskById(id)) ?? null

  const current = await getTaskById(id)
  if (!current) return null

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values     = fields.map(f => (updates as Record<string, unknown>)[f])

  await execute(
    `UPDATE tasks SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
    [id, ...values]
  )

  for (const field of fields) {
    if (!AUDIT_FIELDS.has(field)) continue
    const oldVal = String((current as unknown as Record<string, unknown>)[field] ?? '')
    const newVal = String((updates as Record<string, unknown>)[field] ?? '')
    if (oldVal !== newVal) {
      await execute(
        `INSERT INTO task_audit (task_id, changed_by, action, field, old_value, new_value)
         VALUES ($1, $2, 'update', $3, $4, $5)`,
        [id, changedBy, field, oldVal, newVal]
      )
    }
  }

  return (await getTaskById(id)) ?? null
}

export interface AuditEntry {
  id: string
  task_id: string
  changed_by: string
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  changed_at: string
}

export async function getTaskAudit(taskId: string): Promise<AuditEntry[]> {
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM task_audit WHERE task_id = $1 ORDER BY changed_at DESC LIMIT 100`,
    [taskId]
  )
  return rows.map(r => ({
    id:         String(r.id),
    task_id:    String(r.task_id),
    changed_by: String(r.changed_by),
    action:     String(r.action),
    field:      r.field     ? String(r.field)     : null,
    old_value:  r.old_value ? String(r.old_value) : null,
    new_value:  r.new_value ? String(r.new_value) : null,
    changed_at: String(r.changed_at),
  }))
}

export async function deleteTask(id: string): Promise<boolean> {
  const result = await query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id])
  return result.length > 0
}

export async function addUpdate(
  taskId: string,
  data: { date: string; text: string }
): Promise<TaskUpdate | null> {
  const task = await queryOne('SELECT id FROM tasks WHERE id = $1', [taskId])
  if (!task) return null

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO task_updates (task_id, date, text) VALUES ($1, $2, $3) RETURNING *`,
    [taskId, data.date, data.text]
  )
  if (!row) return null

  return {
    id:         String(row.id),
    task_id:    String(row.task_id),
    date:       String(row.date || ''),
    text:       String(row.text || ''),
    created_at: String(row.created_at || ''),
  }
}

export async function editUpdate(
  updateId: string,
  data: { text?: string; date?: string }
): Promise<TaskUpdate | null> {
  const fields: string[] = []
  const values: unknown[] = []
  if (data.text !== undefined) { fields.push(`text = $${fields.length + 2}`); values.push(data.text) }
  if (data.date !== undefined) { fields.push(`date = $${fields.length + 2}`); values.push(data.date) }
  if (!fields.length) return null
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE task_updates SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
    [updateId, ...values]
  )
  if (!row) return null
  return {
    id:         String(row.id),
    task_id:    String(row.task_id),
    date:       String(row.date || ''),
    text:       String(row.text || ''),
    created_at: String(row.created_at || ''),
  }
}
