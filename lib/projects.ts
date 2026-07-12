import { query, queryOne, execute } from './database'
import { Project, Milestone, ProjectStatus } from '@/types'

let tablesReady = false

async function ensureProjectTables() {
  if (tablesReady) return
  await execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      company     TEXT NOT NULL DEFAULT '',
      owner       TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'active',
      start_date  DATE,
      end_date    DATE,
      budget      NUMERIC(14,2) NOT NULL DEFAULT 0,
      spent       NUMERIC(14,2) NOT NULL DEFAULT 0,
      created_by  TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS milestones (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      due_date   DATE,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_notes (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_name  TEXT NOT NULL DEFAULT '',
      message    TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  tablesReady = true
}

function rowToProject(row: Record<string, unknown>, milestones: Milestone[] = [], task_count = 0, done_count = 0): Project {
  return {
    id:          Number(row.id),
    name:        String(row.name || ''),
    description: String(row.description || ''),
    company:     String(row.company || ''),
    owner:       String(row.owner || ''),
    status:      (row.status as ProjectStatus) || 'active',
    start_date:  row.start_date ? String(row.start_date).slice(0, 10) : '',
    end_date:    row.end_date   ? String(row.end_date).slice(0, 10)   : '',
    budget:      Number(row.budget || 0),
    spent:       Number(row.spent || 0),
    created_by:  String(row.created_by || ''),
    created_at:  String(row.created_at || ''),
    milestones,
    task_count,
    done_count,
  }
}

function rowToMilestone(row: Record<string, unknown>): Milestone {
  return {
    id:         Number(row.id),
    project_id: Number(row.project_id),
    title:      String(row.title || ''),
    due_date:   row.due_date ? String(row.due_date).slice(0, 10) : '',
    status:     (row.status as 'pending' | 'completed') || 'pending',
    created_at: String(row.created_at || ''),
  }
}

export interface ProjectNote {
  id:         number
  project_id: number
  user_name:  string
  message:    string
  created_at: string
}

export async function getProjectNotes(projectId: number): Promise<ProjectNote[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM project_notes WHERE project_id = $1 ORDER BY created_at ASC', [projectId]
  )
  return rows.map(r => ({
    id:         Number(r.id),
    project_id: Number(r.project_id),
    user_name:  String(r.user_name || ''),
    message:    String(r.message || ''),
    created_at: String(r.created_at || ''),
  }))
}

export async function createProjectNote(data: { project_id: number; user_name: string; message: string }): Promise<ProjectNote> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    'INSERT INTO project_notes (project_id, user_name, message) VALUES ($1,$2,$3) RETURNING *',
    [data.project_id, data.user_name, data.message]
  )
  if (!row) throw new Error('Failed to create note')
  return { id: Number(row.id), project_id: Number(row.project_id), user_name: String(row.user_name), message: String(row.message), created_at: String(row.created_at) }
}

export async function deleteProjectNote(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_notes WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

export async function getProjectSpend(projectId: number): Promise<number> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `SELECT COALESCE(SUM(total_amount),0) AS total
     FROM petty_cash_requests
     WHERE project_id = $1 AND status = 'approved'`,
    [projectId]
  ).catch(() => null)
  return Number(row?.total || 0)
}

export async function getProjects(): Promise<Project[]> {
  await ensureProjectTables()

  const [projectRows, milestoneRows, taskCounts, spendRows] = await Promise.all([
    query<Record<string, unknown>>('SELECT * FROM projects ORDER BY created_at DESC'),
    query<Record<string, unknown>>('SELECT * FROM milestones ORDER BY due_date ASC NULLS LAST, created_at ASC'),
    query<Record<string, unknown>>(`
      SELECT project_id,
             COUNT(*)                                    AS total,
             COUNT(*) FILTER (WHERE status = 'resolved') AS done
      FROM tasks WHERE project_id IS NOT NULL GROUP BY project_id
    `),
    query<Record<string, unknown>>(
      `SELECT project_id, COALESCE(SUM(total_amount),0) AS total
       FROM petty_cash_requests WHERE project_id IS NOT NULL AND status='approved' GROUP BY project_id`
    ).catch(() => [] as Record<string, unknown>[]),
  ])

  const msMap: Record<number, Milestone[]> = {}
  milestoneRows.forEach(r => {
    const pid = Number(r.project_id)
    if (!msMap[pid]) msMap[pid] = []
    msMap[pid].push(rowToMilestone(r))
  })

  const countMap: Record<number, { total: number; done: number }> = {}
  taskCounts.forEach(r => {
    countMap[Number(r.project_id)] = { total: Number(r.total), done: Number(r.done) }
  })

  const spendMap: Record<number, number> = {}
  spendRows.forEach(r => { spendMap[Number(r.project_id)] = Number(r.total) })

  return projectRows.map(r => {
    const pid = Number(r.id)
    const c = countMap[pid] || { total: 0, done: 0 }
    return rowToProject({ ...r, spent: spendMap[pid] ?? Number(r.spent ?? 0) }, msMap[pid] || [], c.total, c.done)
  })
}

export async function getProjectById(id: number): Promise<Project | null> {
  await ensureProjectTables()

  const [row, milestoneRows, countRow, spendRow] = await Promise.all([
    queryOne<Record<string, unknown>>('SELECT * FROM projects WHERE id = $1', [id]),
    query<Record<string, unknown>>('SELECT * FROM milestones WHERE project_id = $1 ORDER BY due_date ASC NULLS LAST', [id]),
    queryOne<Record<string, unknown>>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'resolved') AS done FROM tasks WHERE project_id = $1`,
      [id]
    ),
    queryOne<Record<string, unknown>>(
      `SELECT COALESCE(SUM(total_amount),0) AS total FROM petty_cash_requests WHERE project_id=$1 AND status='approved'`,
      [id]
    ).catch(() => null),
  ])
  if (!row) return null
  return rowToProject(
    { ...row, spent: Number(spendRow?.total || 0) },
    milestoneRows.map(rowToMilestone),
    Number(countRow?.total || 0),
    Number(countRow?.done || 0),
  )
}

export async function createProject(data: {
  name: string; description: string; company: string; owner: string
  status: ProjectStatus; start_date: string; end_date: string
  budget: number; created_by: string
}): Promise<Project> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO projects (name, description, company, owner, status, start_date, end_date, budget, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.name, data.description, data.company, data.owner, data.status,
     data.start_date || null, data.end_date || null, data.budget, data.created_by]
  )
  if (!row) throw new Error('Failed to create project')
  return rowToProject(row)
}

export async function updateProject(id: number, data: Partial<{
  name: string; description: string; company: string; owner: string
  status: ProjectStatus; start_date: string; end_date: string
  budget: number; spent: number
}>): Promise<Project | null> {
  await ensureProjectTables()
  const allowed = ['name','description','company','owner','status','start_date','end_date','budget','spent']
  const fields  = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set    = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if ((f === 'start_date' || f === 'end_date') && !v) return null
    return v
  })
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE projects SET ${set} WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToProject(row) : null
}

export async function deleteProject(id: number): Promise<boolean> {
  await ensureProjectTables()
  const rows = await query('DELETE FROM projects WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

export async function createMilestone(data: {
  project_id: number; title: string; due_date: string
}): Promise<Milestone> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO milestones (project_id, title, due_date) VALUES ($1,$2,$3) RETURNING *`,
    [data.project_id, data.title, data.due_date || null]
  )
  if (!row) throw new Error('Failed to create milestone')
  return rowToMilestone(row)
}

export async function updateMilestone(id: number, data: { status?: 'pending' | 'completed'; title?: string; due_date?: string }): Promise<Milestone | null> {
  await ensureProjectTables()
  const allowed = ['status', 'title', 'due_date']
  const fields  = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set    = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if (f === 'due_date' && !v) return null
    return v
  })
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE milestones SET ${set} WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToMilestone(row) : null
}

export async function deleteMilestone(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM milestones WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

export async function getProjectTasks(projectId: number) {
  await ensureProjectTables()
  return query<Record<string, unknown>>(
    `SELECT id, particulars, responsible, status, due_date, company FROM tasks WHERE project_id = $1 ORDER BY created_at DESC`,
    [projectId]
  )
}
