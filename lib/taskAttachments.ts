import { query, queryOne, execute } from './database'

export interface TaskAttachment {
  id:            number
  task_id:       string
  update_id:     string | null
  name:          string
  mime_type:     string
  size:          number
  uploaded_by:   string
  uploader_name: string
  created_at:    string
}

let ready = false
async function ensureTable() {
  if (ready) return
  await execute(`
    CREATE TABLE IF NOT EXISTS task_attachments (
      id            SERIAL PRIMARY KEY,
      task_id       TEXT NOT NULL,
      update_id     TEXT,
      name          TEXT NOT NULL,
      mime_type     TEXT NOT NULL DEFAULT '',
      size          INTEGER NOT NULL DEFAULT 0,
      data          BYTEA NOT NULL,
      uploaded_by   TEXT NOT NULL DEFAULT '',
      uploader_name TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_task_att ON task_attachments(task_id)`)
  ready = true
}

function rowToAtt(r: Record<string, unknown>): TaskAttachment {
  return {
    id:            Number(r.id),
    task_id:       String(r.task_id),
    update_id:     r.update_id ? String(r.update_id) : null,
    name:          String(r.name),
    mime_type:     String(r.mime_type),
    size:          Number(r.size),
    uploaded_by:   String(r.uploaded_by),
    uploader_name: String(r.uploader_name),
    created_at:    String(r.created_at),
  }
}

export async function saveTaskAttachment(p: {
  task_id: string; update_id?: string | null
  name: string; mime_type: string; size: number; buffer: Buffer
  uploaded_by: string; uploader_name: string
}): Promise<TaskAttachment> {
  await ensureTable()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO task_attachments (task_id, update_id, name, mime_type, size, data, uploaded_by, uploader_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, task_id, update_id, name, mime_type, size, uploaded_by, uploader_name, created_at`,
    [p.task_id, p.update_id ?? null, p.name, p.mime_type, p.size, p.buffer, p.uploaded_by, p.uploader_name]
  )
  if (!row) throw new Error('Failed to save attachment')
  return rowToAtt(row)
}

export async function listTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  await ensureTable()
  const rows = await query<Record<string, unknown>>(
    `SELECT id, task_id, update_id, name, mime_type, size, uploaded_by, uploader_name, created_at
     FROM task_attachments WHERE task_id = $1 ORDER BY created_at ASC`,
    [taskId]
  )
  return rows.map(rowToAtt)
}

export async function getTaskAttachmentData(id: number): Promise<{ data: Buffer; mime_type: string; name: string } | null> {
  await ensureTable()
  const row = await queryOne<Record<string, unknown>>(
    `SELECT data, mime_type, name FROM task_attachments WHERE id = $1`, [id]
  )
  if (!row) return null
  const raw = row.data as Buffer | { data: number[] } | string
  const data = Buffer.isBuffer(raw)
    ? raw
    : typeof raw === 'string'
    ? Buffer.from(raw, 'hex')
    : Buffer.from((raw as { data: number[] }).data)
  return { data, mime_type: String(row.mime_type), name: String(row.name) }
}

export async function deleteTaskAttachment(id: number): Promise<boolean> {
  await ensureTable()
  const rows = await query('DELETE FROM task_attachments WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}
