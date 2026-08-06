import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
  const { rows } = await pool.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | null> {
  const { rows } = await pool.query(sql, params);
  return rows[0] as T ?? null;
}

export async function execute(sql: string, params?: unknown[]): Promise<void> {
  await pool.query(sql, params);
}

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shelf_folders (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      parent_id   UUID REFERENCES shelf_folders(id) ON DELETE CASCADE,
      color       TEXT NOT NULL DEFAULT '#6366f1',
      created_by  TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS shelf_files (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      folder_id     UUID REFERENCES shelf_folders(id) ON DELETE SET NULL,
      name          TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type     TEXT NOT NULL,
      file_size     INTEGER NOT NULL,
      file_data     BYTEA NOT NULL,
      description   TEXT,
      tags          TEXT[] NOT NULL DEFAULT '{}',
      uploaded_by   TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS shelf_files_folder_idx ON shelf_files (folder_id);
    CREATE INDEX IF NOT EXISTS shelf_folders_parent_idx ON shelf_folders (parent_id);
  `);

  // Seed default folders if none exist
  const { rows } = await pool.query("SELECT COUNT(*) AS c FROM shelf_folders WHERE parent_id IS NULL");
  if (parseInt(rows[0].c) === 0) {
    await pool.query(`
      INSERT INTO shelf_folders (name, color, created_by) VALUES
        ('Legal & Compliance',   '#dc2626', 'system'),
        ('Lease Agreements',     '#2563eb', 'system'),
        ('Finance & Accounting', '#16a34a', 'system'),
        ('Maintenance Records',  '#d97706', 'system'),
        ('Insurance',            '#7c3aed', 'system'),
        ('Correspondence',       '#0891b2', 'system'),
        ('HR & Personnel',       '#db2777', 'system')
    `);
  }
}
