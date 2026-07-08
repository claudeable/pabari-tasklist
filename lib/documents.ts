import { query, queryOne, execute } from './database'
export { DOC_ENTITIES, DEFAULT_CATEGORIES } from './doc-constants'
import { DEFAULT_CATEGORIES } from './doc-constants'

export interface DocMeta {
  id:            number
  name:          string
  entity:        string
  folder:        string
  doc_type:      string
  expiry_date:   string | null
  mime_type:     string
  size:          number
  uploaded_by:   string
  uploader_name: string
  created_at:    string
}

export interface FolderSummary {
  name:           string
  count:          number
  expiring_count: number  // expiring within 30 days
}

let docReady    = false
let folderReady = false

async function ensureDocTable() {
  if (docReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS documents (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      folder        TEXT NOT NULL DEFAULT 'General',
      mime_type     TEXT NOT NULL DEFAULT '',
      size          INTEGER NOT NULL DEFAULT 0,
      data          BYTEA NOT NULL,
      uploaded_by   TEXT NOT NULL DEFAULT '',
      uploader_name TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // New columns (idempotent)
  await execute(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS entity      TEXT NOT NULL DEFAULT 'Group'`)
  await execute(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS expiry_date DATE`)
  await execute(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_type    TEXT NOT NULL DEFAULT ''`)
  await execute(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id   INTEGER`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_docs_entity ON documents(entity)`)
  await execute(`CREATE INDEX IF NOT EXISTS idx_docs_folder ON documents(folder)`)
  docReady = true
}

async function ensureFolderTable() {
  if (folderReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS document_folders (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)
  // Idempotent column additions (kept from earlier migration)
  await execute(`ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS parent_id INTEGER`)
  await execute(`ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS path      TEXT`)
  await execute(`UPDATE document_folders SET path = name WHERE path IS NULL`)

  // Seed default categories if none exist
  const rows = await query(`SELECT COUNT(*)::int AS cnt FROM document_folders`)
  if (Number((rows[0] as Record<string, unknown>).cnt) === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await execute(`INSERT INTO document_folders (name, path) VALUES ($1, $1) ON CONFLICT DO NOTHING`, [cat])
    }
  }
  folderReady = true
}

function rowToDoc(r: Record<string, unknown>): DocMeta {
  return {
    id:            Number(r.id),
    name:          String(r.name),
    entity:        String(r.entity || 'Group'),
    folder:        String(r.folder || ''),
    doc_type:      String(r.doc_type || ''),
    expiry_date:   r.expiry_date ? String(r.expiry_date).slice(0, 10) : null,
    mime_type:     String(r.mime_type || ''),
    size:          Number(r.size),
    uploaded_by:   String(r.uploaded_by || ''),
    uploader_name: String(r.uploader_name || ''),
    created_at:    String(r.created_at),
  }
}

// ── Folders ───────────────────────────────────────────────────────────────────

export async function getFolderSummaries(entity: string): Promise<FolderSummary[]> {
  await ensureDocTable()
  await ensureFolderTable()
  const rows = await query<Record<string, unknown>>(`
    SELECT df.name,
      COALESCE(SUM(CASE WHEN d.entity = $1 THEN 1 ELSE 0 END)::int, 0) AS count,
      COALESCE(SUM(CASE WHEN d.entity = $1
        AND d.expiry_date IS NOT NULL
        AND d.expiry_date >= CURRENT_DATE
        AND d.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
        THEN 1 ELSE 0 END)::int, 0) AS expiring_count
    FROM document_folders df
    LEFT JOIN documents d ON d.folder = df.name
    GROUP BY df.name
    ORDER BY df.name
  `, [entity])
  return rows.map(r => ({
    name:           String(r.name),
    count:          Number(r.count),
    expiring_count: Number(r.expiring_count),
  }))
}

export async function getAllFolderNames(): Promise<string[]> {
  await ensureFolderTable()
  const rows = await query<Record<string, unknown>>(`SELECT name FROM document_folders ORDER BY name`)
  return rows.map(r => String(r.name))
}

export async function createFolder(name: string): Promise<string> {
  await ensureFolderTable()
  await execute(
    `INSERT INTO document_folders (name, path) VALUES ($1, $1) ON CONFLICT (name) DO NOTHING`, [name]
  )
  return name
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  await ensureFolderTable()
  await execute(`UPDATE document_folders SET name=$1, path=$1 WHERE name=$2`, [newName, oldName])
  await execute(`UPDATE documents SET folder=$1 WHERE folder=$2`, [newName, oldName])
}

export async function deleteFolder(name: string): Promise<{ count: number; deleted: boolean }> {
  await ensureDocTable()
  await ensureFolderTable()
  const rows  = await query<Record<string, unknown>>(`SELECT COUNT(*)::int AS cnt FROM documents WHERE folder=$1`, [name])
  const count = Number((rows[0] as Record<string, unknown>).cnt || 0)
  if (count > 0) return { count, deleted: false }
  await execute(`DELETE FROM document_folders WHERE name=$1`, [name])
  return { count: 0, deleted: true }
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function listDocuments(entity: string, folder?: string): Promise<DocMeta[]> {
  await ensureDocTable()
  const rows = folder
    ? await query<Record<string, unknown>>(
        `SELECT id,name,entity,folder,doc_type,expiry_date,mime_type,size,uploaded_by,uploader_name,created_at
         FROM documents WHERE entity=$1 AND folder=$2 ORDER BY created_at DESC`,
        [entity, folder])
    : await query<Record<string, unknown>>(
        `SELECT id,name,entity,folder,doc_type,expiry_date,mime_type,size,uploaded_by,uploader_name,created_at
         FROM documents WHERE entity=$1 ORDER BY created_at DESC`,
        [entity])
  return rows.map(rowToDoc)
}

export async function getAllExpiringDocuments(): Promise<DocMeta[]> {
  await ensureDocTable()
  const rows = await query<Record<string, unknown>>(
    `SELECT id,name,entity,folder,doc_type,expiry_date,mime_type,size,uploaded_by,uploader_name,created_at
     FROM documents
     WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'
     ORDER BY expiry_date ASC`
  )
  return rows.map(rowToDoc)
}

export async function getExpiringCount(): Promise<number> {
  await ensureDocTable()
  const rows = await query<Record<string, unknown>>(
    `SELECT COUNT(*)::int AS cnt FROM documents WHERE expiry_date IS NOT NULL AND expiry_date <= CURRENT_DATE + INTERVAL '30 days'`
  )
  return Number((rows[0] as Record<string, unknown>).cnt || 0)
}

export async function saveDocument(data: {
  name: string; entity: string; folder: string; doc_type: string
  expiry_date?: string | null; mime_type: string; size: number
  buffer: Buffer; uploaded_by: string; uploader_name: string
}): Promise<DocMeta> {
  await ensureDocTable()
  await ensureFolderTable()
  // Ensure folder exists
  await execute(`INSERT INTO document_folders (name, path) VALUES ($1, $1) ON CONFLICT (name) DO NOTHING`, [data.folder])

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO documents (name, entity, folder, doc_type, expiry_date, mime_type, size, data, uploaded_by, uploader_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, name, entity, folder, doc_type, expiry_date, mime_type, size, uploaded_by, uploader_name, created_at`,
    [data.name, data.entity, data.folder, data.doc_type || '', data.expiry_date || null,
     data.mime_type, data.size, data.buffer, data.uploaded_by, data.uploader_name]
  )
  if (!row) throw new Error('Upload failed')
  return rowToDoc(row)
}

export async function getDocumentFile(id: number): Promise<{ name: string; mime_type: string; data: Buffer } | null> {
  await ensureDocTable()
  const row = await queryOne<Record<string, unknown>>(`SELECT name, mime_type, data FROM documents WHERE id=$1`, [id])
  if (!row) return null
  return { name: String(row.name), mime_type: String(row.mime_type || ''), data: row.data as Buffer }
}

export async function deleteDocument(id: number): Promise<boolean> {
  await ensureDocTable()
  const rows = await query(`DELETE FROM documents WHERE id=$1 RETURNING id`, [id])
  return rows.length > 0
}

export async function moveDocument(docId: number, folder: string): Promise<boolean> {
  await ensureDocTable()
  const rows = await query(`UPDATE documents SET folder=$1 WHERE id=$2 RETURNING id`, [folder, docId])
  return rows.length > 0
}

export async function updateDocumentExpiry(docId: number, expiry_date: string | null): Promise<boolean> {
  await ensureDocTable()
  const rows = await query(`UPDATE documents SET expiry_date=$1 WHERE id=$2 RETURNING id`, [expiry_date || null, docId])
  return rows.length > 0
}
