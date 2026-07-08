import { query, queryOne, execute } from './database'

export interface DocMeta {
  id:            number
  name:          string
  folder_id:     number | null
  folder_path:   string
  mime_type:     string
  size:          number
  uploaded_by:   string
  uploader_name: string
  created_at:    string
}

export interface FolderRecord {
  id:         number
  name:       string
  parent_id:  number | null
  path:       string
  count:      number   // direct files in this folder
  children:   number   // subfolders
  created_at: string
}

let docTableReady    = false
let folderTableReady = false

async function ensureDocTable() {
  if (docTableReady) return
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
  docTableReady = true
}

async function ensureFolderTable() {
  if (folderTableReady) return

  // Base table (idempotent)
  await execute(`
    CREATE TABLE IF NOT EXISTS document_folders (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // Add new columns for subfolder support
  await execute(`ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS parent_id INTEGER`)
  await execute(`ALTER TABLE document_folders ADD COLUMN IF NOT EXISTS path TEXT`)

  // Add folder_id to documents (FK to document_folders)
  await execute(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder_id INTEGER`)

  // Drop old unique-name constraint (may not exist)
  await execute(`
    DO $$ BEGIN
      ALTER TABLE document_folders DROP CONSTRAINT document_folders_name_key;
    EXCEPTION WHEN undefined_object THEN NULL; END $$
  `)

  // Per-parent unique indexes (NULL-safe)
  await execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_df_root_name  ON document_folders(name)            WHERE parent_id IS NULL`)
  await execute(`CREATE UNIQUE INDEX IF NOT EXISTS idx_df_child_name ON document_folders(name, parent_id) WHERE parent_id IS NOT NULL`)

  // Set path = name for any existing root folders without path
  await execute(`UPDATE document_folders SET path = name WHERE path IS NULL`)

  // Link existing documents to folder_id by matching folder text → root folder name
  await execute(`
    UPDATE documents d SET folder_id = df.id
    FROM document_folders df
    WHERE df.name = d.folder AND df.parent_id IS NULL AND d.folder_id IS NULL
  `)

  folderTableReady = true
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function rowToMeta(r: Record<string, unknown>): DocMeta {
  return {
    id:            Number(r.id),
    name:          String(r.name),
    folder_id:     r.folder_id ? Number(r.folder_id) : null,
    folder_path:   String(r.folder_path || r.folder || ''),
    mime_type:     String(r.mime_type || ''),
    size:          Number(r.size),
    uploaded_by:   String(r.uploaded_by || ''),
    uploader_name: String(r.uploader_name || ''),
    created_at:    String(r.created_at),
  }
}

function rowToFolder(r: Record<string, unknown>): FolderRecord {
  return {
    id:         Number(r.id),
    name:       String(r.name),
    parent_id:  r.parent_id ? Number(r.parent_id) : null,
    path:       String(r.path || r.name),
    count:      Number(r.count || 0),
    children:   Number(r.children || 0),
    created_at: String(r.created_at),
  }
}

const FOLDER_SELECT = `
  SELECT df.id, df.name, df.parent_id, df.path, df.created_at,
    COALESCE(d.cnt, 0)      AS count,
    COALESCE(c.children, 0) AS children
  FROM document_folders df
  LEFT JOIN (SELECT folder_id, COUNT(*)::int AS cnt FROM documents GROUP BY folder_id) d
    ON d.folder_id = df.id
  LEFT JOIN (SELECT parent_id, COUNT(*)::int AS children FROM document_folders WHERE parent_id IS NOT NULL GROUP BY parent_id) c
    ON c.parent_id = df.id
`

// ── Public API ────────────────────────────────────────────────────────────────

/** Folders at a specific level. parentId=null → root level. */
export async function getFolders(parentId: number | null = null): Promise<FolderRecord[]> {
  await ensureDocTable()
  await ensureFolderTable()
  const rows = parentId === null
    ? await query<Record<string, unknown>>(`${FOLDER_SELECT} WHERE df.parent_id IS NULL ORDER BY df.name`)
    : await query<Record<string, unknown>>(`${FOLDER_SELECT} WHERE df.parent_id=$1 ORDER BY df.name`, [parentId])
  return rows.map(rowToFolder)
}

/** All folders flat (for search / upload pickers). */
export async function getAllFolders(): Promise<FolderRecord[]> {
  await ensureDocTable()
  await ensureFolderTable()
  const rows = await query<Record<string, unknown>>(`${FOLDER_SELECT} ORDER BY df.path`)
  return rows.map(rowToFolder)
}

export async function getFolderById(id: number): Promise<FolderRecord | null> {
  await ensureFolderTable()
  const rows = await query<Record<string, unknown>>(`${FOLDER_SELECT} WHERE df.id=$1`, [id])
  return rows[0] ? rowToFolder(rows[0]) : null
}

export async function createFolder(name: string, parentId?: number | null): Promise<FolderRecord> {
  await ensureFolderTable()
  let path = name
  if (parentId) {
    const parent = await queryOne<Record<string, unknown>>(
      `SELECT path FROM document_folders WHERE id=$1`, [parentId]
    )
    if (!parent) throw new Error('Parent folder not found')
    path = `${String(parent.path)}/${name}`
  }
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO document_folders (name, parent_id, path) VALUES ($1, $2, $3)
     RETURNING id, name, parent_id, path, created_at`,
    [name, parentId ?? null, path]
  )
  if (!row) throw new Error('Failed to create folder')
  return rowToFolder({ ...row, count: 0, children: 0 })
}

export async function renameFolder(id: number, newName: string): Promise<void> {
  await ensureDocTable()
  await ensureFolderTable()
  const current = await queryOne<Record<string, unknown>>(
    `SELECT name, parent_id, path FROM document_folders WHERE id=$1`, [id]
  )
  if (!current) throw new Error('Folder not found')

  const oldPath = String(current.path || current.name)
  let newPath   = newName
  if (current.parent_id) {
    const parent = await queryOne<Record<string, unknown>>(
      `SELECT path FROM document_folders WHERE id=$1`, [current.parent_id]
    )
    if (parent) newPath = `${String(parent.path)}/${newName}`
  }

  const oldLen = oldPath.length
  // Update this folder
  await execute(`UPDATE document_folders SET name=$1, path=$2 WHERE id=$3`, [newName, newPath, id])
  // Update descendant folder paths
  await execute(
    `UPDATE document_folders SET path=$1 || SUBSTRING(path FROM ${oldLen + 1}) WHERE path LIKE $2`,
    [newPath, `${oldPath}/%`]
  )
  // Update documents (keep folder text in sync for readability)
  await execute(`UPDATE documents SET folder=$1 WHERE folder=$2`, [newPath, oldPath])
  await execute(
    `UPDATE documents SET folder=$1 || SUBSTRING(folder FROM ${oldLen + 1}) WHERE folder LIKE $2`,
    [newPath, `${oldPath}/%`]
  )
}

export async function deleteFolder(id: number): Promise<{ fileCount: number; childCount: number; deleted: boolean }> {
  await ensureDocTable()
  await ensureFolderTable()
  const files    = await query<Record<string, unknown>>(`SELECT COUNT(*)::int AS cnt FROM documents WHERE folder_id=$1`, [id])
  const children = await query<Record<string, unknown>>(`SELECT COUNT(*)::int AS cnt FROM document_folders WHERE parent_id=$1`, [id])
  const fileCount  = Number((files[0] as Record<string, unknown>).cnt || 0)
  const childCount = Number((children[0] as Record<string, unknown>).cnt || 0)
  if (fileCount > 0 || childCount > 0) return { fileCount, childCount, deleted: false }
  await execute(`DELETE FROM document_folders WHERE id=$1`, [id])
  return { fileCount: 0, childCount: 0, deleted: true }
}

/** List documents. folderId = specific folder, undefined = all documents. */
export async function listDocuments(folderId?: number): Promise<DocMeta[]> {
  await ensureDocTable()
  await ensureFolderTable()
  const DOC_SELECT = `
    SELECT d.id, d.name, d.folder_id,
      COALESCE(df.path, d.folder) AS folder_path,
      d.mime_type, d.size, d.uploaded_by, d.uploader_name, d.created_at
    FROM documents d
    LEFT JOIN document_folders df ON df.id = d.folder_id
  `
  const rows = folderId !== undefined
    ? await query<Record<string, unknown>>(`${DOC_SELECT} WHERE d.folder_id=$1 ORDER BY d.created_at DESC`, [folderId])
    : await query<Record<string, unknown>>(`${DOC_SELECT} ORDER BY d.created_at DESC`)
  return rows.map(rowToMeta)
}

export async function saveDocument(data: {
  name: string; folder_id: number; mime_type: string
  size: number; buffer: Buffer; uploaded_by: string; uploader_name: string
}): Promise<DocMeta> {
  await ensureDocTable()
  await ensureFolderTable()
  const folder = await queryOne<Record<string, unknown>>(
    `SELECT id, path FROM document_folders WHERE id=$1`, [data.folder_id]
  )
  if (!folder) throw new Error('Folder not found')
  const folderPath = String(folder.path || '')

  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO documents (name, folder, folder_id, mime_type, size, data, uploaded_by, uploader_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, name, folder_id, mime_type, size, uploaded_by, uploader_name, created_at`,
    [data.name, folderPath, data.folder_id, data.mime_type, data.size, data.buffer, data.uploaded_by, data.uploader_name]
  )
  if (!row) throw new Error('Upload failed')
  return rowToMeta({ ...row, folder_path: folderPath })
}

export async function getDocumentFile(id: number): Promise<{ name: string; mime_type: string; data: Buffer } | null> {
  await ensureDocTable()
  const row = await queryOne<Record<string, unknown>>(
    `SELECT name, mime_type, data FROM documents WHERE id=$1`, [id]
  )
  if (!row) return null
  return { name: String(row.name), mime_type: String(row.mime_type || ''), data: row.data as Buffer }
}

export async function moveDocument(docId: number, folderId: number): Promise<boolean> {
  await ensureDocTable()
  await ensureFolderTable()
  const folder = await queryOne<Record<string, unknown>>(
    `SELECT id, path FROM document_folders WHERE id=$1`, [folderId]
  )
  if (!folder) return false
  const rows = await query(
    `UPDATE documents SET folder_id=$1, folder=$2 WHERE id=$3 RETURNING id`,
    [folderId, String(folder.path), docId]
  )
  return rows.length > 0
}

export async function deleteDocument(id: number): Promise<boolean> {
  await ensureDocTable()
  const rows = await query(`DELETE FROM documents WHERE id=$1 RETURNING id`, [id])
  return rows.length > 0
}
