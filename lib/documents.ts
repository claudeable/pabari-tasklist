import { query, queryOne, execute } from './database'

export interface DocMeta {
  id:            number
  name:          string
  folder:        string
  mime_type:     string
  size:          number
  uploaded_by:   string
  uploader_name: string
  created_at:    string
}

export interface FolderRecord {
  name:       string
  count:      number
  created_at: string
}

let ready       = false
let folderReady = false

async function ensureTable() {
  if (ready) return
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
  await execute(`CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents(folder)`)
  ready = true
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
  folderReady = true
}

function rowToMeta(r: Record<string, unknown>): DocMeta {
  return {
    id:            Number(r.id),
    name:          String(r.name),
    folder:        String(r.folder),
    mime_type:     String(r.mime_type || ''),
    size:          Number(r.size),
    uploaded_by:   String(r.uploaded_by || ''),
    uploader_name: String(r.uploader_name || ''),
    created_at:    String(r.created_at),
  }
}

export async function listDocuments(folder?: string): Promise<DocMeta[]> {
  await ensureTable()
  const rows = folder
    ? await query<Record<string, unknown>>(
        `SELECT id,name,folder,mime_type,size,uploaded_by,uploader_name,created_at
         FROM documents WHERE folder=$1 ORDER BY created_at DESC`, [folder])
    : await query<Record<string, unknown>>(
        `SELECT id,name,folder,mime_type,size,uploaded_by,uploader_name,created_at
         FROM documents ORDER BY created_at DESC`)
  return rows.map(rowToMeta)
}

export async function getFolders(): Promise<FolderRecord[]> {
  await ensureTable()
  await ensureFolderTable()
  // Merge explicit folders + any orphan folders from uploaded docs
  const rows = await query<Record<string, unknown>>(`
    SELECT coalesce(f.name, d.folder) AS name,
           coalesce(d.cnt, 0)         AS count,
           coalesce(f.created_at, NOW()) AS created_at
    FROM document_folders f
    FULL OUTER JOIN (
      SELECT folder, COUNT(*)::int AS cnt FROM documents GROUP BY folder
    ) d ON d.folder = f.name
    ORDER BY name
  `)
  return rows.map(r => ({
    name:       String(r.name),
    count:      Number(r.count),
    created_at: String(r.created_at),
  }))
}

export async function createFolder(name: string): Promise<FolderRecord> {
  await ensureFolderTable()
  await execute(
    `INSERT INTO document_folders (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]
  )
  const row = await queryOne<Record<string, unknown>>(
    `SELECT name, created_at FROM document_folders WHERE name=$1`, [name]
  )
  return { name: String(row!.name), count: 0, created_at: String(row!.created_at) }
}

export async function renameFolder(oldName: string, newName: string): Promise<void> {
  await ensureTable()
  await ensureFolderTable()
  await execute(`UPDATE documents          SET folder=$1 WHERE folder=$2`, [newName, oldName])
  await execute(`UPDATE document_folders   SET name=$1   WHERE name=$2`,   [newName, oldName])
}

export async function deleteFolder(name: string): Promise<{ fileCount: number; deleted: boolean }> {
  await ensureTable()
  await ensureFolderTable()
  const rows  = await query<Record<string, unknown>>(`SELECT COUNT(*)::int AS cnt FROM documents WHERE folder=$1`, [name])
  const count = Number((rows[0] as Record<string, unknown>).cnt || 0)
  if (count > 0) return { fileCount: count, deleted: false }
  await execute(`DELETE FROM document_folders WHERE name=$1`, [name])
  return { fileCount: 0, deleted: true }
}

export async function saveDocument(data: {
  name: string; folder: string; mime_type: string
  size: number; buffer: Buffer; uploaded_by: string; uploader_name: string
}): Promise<DocMeta> {
  await ensureTable()
  await ensureFolderTable()
  // Ensure folder exists in document_folders
  await execute(
    `INSERT INTO document_folders (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [data.folder]
  )
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO documents (name,folder,mime_type,size,data,uploaded_by,uploader_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING id,name,folder,mime_type,size,uploaded_by,uploader_name,created_at`,
    [data.name, data.folder, data.mime_type, data.size, data.buffer, data.uploaded_by, data.uploader_name]
  )
  if (!row) throw new Error('Upload failed')
  return rowToMeta(row)
}

export async function getDocumentFile(id: number): Promise<{ name: string; mime_type: string; data: Buffer } | null> {
  await ensureTable()
  const row = await queryOne<Record<string, unknown>>(
    `SELECT name, mime_type, data FROM documents WHERE id=$1`, [id])
  if (!row) return null
  return { name: String(row.name), mime_type: String(row.mime_type || ''), data: row.data as Buffer }
}

export async function deleteDocument(id: number): Promise<boolean> {
  await ensureTable()
  const rows = await query(`DELETE FROM documents WHERE id=$1 RETURNING id`, [id])
  return rows.length > 0
}

export async function moveDocument(id: number, folder: string): Promise<boolean> {
  await ensureTable()
  const rows = await query(
    `UPDATE documents SET folder=$1 WHERE id=$2 RETURNING id`,
    [folder, id]
  )
  return rows.length > 0
}
