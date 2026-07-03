import { query, queryOne, execute } from './database'
import { Task, TaskUpdate, TaskPriority } from '@/types'

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
    status:       (row.status as Task['status']) || 'pending-discussion',
    priority:     (row.priority as TaskPriority) || 'medium',
    status_wk:    String(row.status_wk || ''),
    hk_comment:   String(row.hk_comment || ''),
    hod_comment:  String(row.hod_comment || ''),
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
  data: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'task_updates'>
): Promise<Task> {
  const now = new Date().toISOString()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO tasks (sno, date, company, category, section, particulars, updates,
       responsible, payment, status, priority, status_wk, hk_comment, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     RETURNING *`,
    [data.sno, data.date, data.company, data.category, data.section, data.particulars,
     data.updates, data.responsible, data.payment, data.status, data.priority ?? 'medium',
     data.status_wk, data.hk_comment, now, now]
  )
  if (!row) throw new Error('Failed to create task')
  return rowToTask({ ...row, task_updates: [] })
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task | null> {
  const allowed = ['status', 'priority', 'hk_comment', 'hod_comment', 'updates', 'responsible',
                   'section', 'category', 'particulars', 'date', 'company', 'payment', 'status_wk']
  const fields = Object.keys(updates).filter(k => allowed.includes(k))
  if (fields.length === 0) return (await getTaskById(id)) ?? null

  const setClauses = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values     = fields.map(f => (updates as Record<string, unknown>)[f])

  await execute(
    `UPDATE tasks SET ${setClauses}, updated_at = NOW() WHERE id = $1`,
    [id, ...values]
  )
  return (await getTaskById(id)) ?? null
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
