import { query, queryOne, execute } from './database'
import { Project, Milestone, ProjectStatus, RAGStatus, ProjectMember, StatusReport, ProjectExpense, ProjectUpdate, ProjectUpdateComment, ProjectMeeting, MeetingActionTask, ProjectDecision, ProjectRisk, ProjectActivity, UpdateType, UpdateStatus, DecisionStatus, RiskType, RiskSeverity, RiskStatus } from '@/types'

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
  await execute(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS rag_status TEXT NOT NULL DEFAULT 'not-set'`)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_members (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_name  TEXT NOT NULL DEFAULT '',
      role       TEXT NOT NULL DEFAULT 'member',
      added_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(project_id, user_name)
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_status_reports (
      id         SERIAL PRIMARY KEY,
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      author     TEXT NOT NULL DEFAULT '',
      rag        TEXT NOT NULL DEFAULT 'not-set',
      narrative  TEXT NOT NULL DEFAULT '',
      blockers   TEXT NOT NULL DEFAULT '',
      next_steps TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_expenses (
      id           SERIAL PRIMARY KEY,
      project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      description  TEXT NOT NULL DEFAULT '',
      amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
      expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
      category     TEXT NOT NULL DEFAULT 'General',
      logged_by    TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_updates (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type        TEXT NOT NULL DEFAULT 'general',
      status      TEXT NOT NULL DEFAULT 'open',
      title       TEXT NOT NULL DEFAULT '',
      body        TEXT NOT NULL DEFAULT '',
      owner       TEXT NOT NULL DEFAULT '',
      next_steps  TEXT NOT NULL DEFAULT '',
      posted_by   TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_update_comments (
      id         SERIAL PRIMARY KEY,
      update_id  INTEGER NOT NULL REFERENCES project_updates(id) ON DELETE CASCADE,
      user_name  TEXT NOT NULL DEFAULT '',
      message    TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_meetings (
      id            SERIAL PRIMARY KEY,
      project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title         TEXT NOT NULL DEFAULT '',
      meeting_date  DATE,
      attendees     TEXT NOT NULL DEFAULT '',
      agenda        TEXT NOT NULL DEFAULT '',
      notes         TEXT NOT NULL DEFAULT '',
      action_points TEXT NOT NULL DEFAULT '',
      logged_by     TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_decisions (
      id            SERIAL PRIMARY KEY,
      project_id    INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title         TEXT NOT NULL DEFAULT '',
      description   TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'pending',
      owner         TEXT NOT NULL DEFAULT '',
      decision_date DATE,
      source        TEXT NOT NULL DEFAULT '',
      created_by    TEXT NOT NULL DEFAULT '',
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_project_decisions_project ON project_decisions(project_id)`)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_risks (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      type        TEXT NOT NULL DEFAULT 'risk',
      title       TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      owner       TEXT NOT NULL DEFAULT '',
      severity    TEXT NOT NULL DEFAULT 'medium',
      status      TEXT NOT NULL DEFAULT 'open',
      mitigation  TEXT NOT NULL DEFAULT '',
      target_date DATE,
      created_by  TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_project_risks_project ON project_risks(project_id)`)
  await execute(`
    CREATE TABLE IF NOT EXISTS project_activity (
      id          BIGSERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      actor       TEXT    NOT NULL DEFAULT '',
      action_type TEXT    NOT NULL DEFAULT '',
      entity_type TEXT    NOT NULL DEFAULT '',
      entity_id   INTEGER,
      description TEXT    NOT NULL DEFAULT '',
      metadata    JSONB,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`CREATE INDEX IF NOT EXISTS idx_project_activity_project ON project_activity(project_id, created_at DESC)`)
  // Links a specific action-point line (by its text) in a meeting to the task created from it.
  // UNIQUE(meeting_id, action_text) prevents duplicate conversion of the same action point.
  await execute(`
    CREATE TABLE IF NOT EXISTS meeting_action_tasks (
      id          SERIAL PRIMARY KEY,
      meeting_id  INTEGER NOT NULL REFERENCES project_meetings(id) ON DELETE CASCADE,
      action_text TEXT    NOT NULL DEFAULT '',
      task_id     INTEGER NOT NULL,
      created_by  TEXT    NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(meeting_id, action_text)
    )
  `)
  // Branch isolation — existing projects belong to Kenya
  await execute("ALTER TABLE projects ADD COLUMN IF NOT EXISTS branch TEXT NOT NULL DEFAULT 'kenya'").catch(() => {})
  // Gantt + phased investment on milestones
  await execute("ALTER TABLE milestones ADD COLUMN IF NOT EXISTS start_date DATE").catch(() => {})
  await execute("ALTER TABLE milestones ADD COLUMN IF NOT EXISTS color TEXT NOT NULL DEFAULT '#2563eb'").catch(() => {})
  await execute("ALTER TABLE milestones ADD COLUMN IF NOT EXISTS amount NUMERIC(14,2) NOT NULL DEFAULT 0").catch(() => {})
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
    rag_status:  (row.rag_status as RAGStatus)  || 'not-set',
    start_date:  row.start_date ? (row.start_date instanceof Date ? row.start_date.toISOString() : String(row.start_date)).slice(0, 10) : '',
    end_date:    row.end_date   ? (row.end_date   instanceof Date ? row.end_date.toISOString()   : String(row.end_date)).slice(0, 10)   : '',
    budget:      Number(row.budget || 0),
    spent:       Number(row.spent || 0),
    created_by:  String(row.created_by || ''),
    created_at:  String(row.created_at || ''),
    milestones,
    task_count,
    done_count,
  }
}

function rowToMember(row: Record<string, unknown>): ProjectMember {
  return {
    id:         Number(row.id),
    project_id: Number(row.project_id),
    user_name:  String(row.user_name || ''),
    role:       String(row.role || 'member'),
    added_at:   String(row.added_at || ''),
  }
}

function rowToReport(row: Record<string, unknown>): StatusReport {
  return {
    id:         Number(row.id),
    project_id: Number(row.project_id),
    author:     String(row.author || ''),
    rag:        (row.rag as RAGStatus) || 'not-set',
    narrative:  String(row.narrative || ''),
    blockers:   String(row.blockers || ''),
    next_steps: String(row.next_steps || ''),
    created_at: String(row.created_at || ''),
  }
}

function rowToMilestone(row: Record<string, unknown>): Milestone {
  const toDate = (v: unknown) => v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : ''
  return {
    id:         Number(row.id),
    project_id: Number(row.project_id),
    title:      String(row.title || ''),
    start_date: toDate(row.start_date),
    due_date:   toDate(row.due_date),
    status:     (row.status as Milestone['status']) || 'pending',
    color:      String(row.color || '#2563eb'),
    amount:     Number(row.amount || 0),
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

export async function getProjects(branch?: string): Promise<Project[]> {
  await ensureProjectTables()

  const [projectRows, milestoneRows, taskCounts, pcrSpendRows, manualSpendRows, lpoSpendRows] = await Promise.all([
    branch
      ? query<Record<string, unknown>>('SELECT * FROM projects WHERE branch = $1 ORDER BY created_at DESC', [branch])
      : query<Record<string, unknown>>('SELECT * FROM projects ORDER BY created_at DESC'),
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
    query<Record<string, unknown>>(
      `SELECT project_id, COALESCE(SUM(amount),0) AS total FROM project_expenses GROUP BY project_id`
    ).catch(() => [] as Record<string, unknown>[]),
    // LPOs accepted or paid count as committed spend
    query<Record<string, unknown>>(
      `SELECT project_id, COALESCE(SUM(total),0) AS total
       FROM invoices WHERE project_id IS NOT NULL AND type='lpo' AND status IN ('accepted','paid') GROUP BY project_id`
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

  const pcrSpendMap: Record<number, number> = {}
  pcrSpendRows.forEach(r => { pcrSpendMap[Number(r.project_id)] = Number(r.total) })
  const manualSpendMap: Record<number, number> = {}
  manualSpendRows.forEach(r => { manualSpendMap[Number(r.project_id)] = Number(r.total) })
  const lpoSpendMap: Record<number, number> = {}
  lpoSpendRows.forEach(r => { lpoSpendMap[Number(r.project_id)] = Number(r.total) })

  return projectRows.map(r => {
    const pid = Number(r.id)
    const c = countMap[pid] || { total: 0, done: 0 }
    const spent = (pcrSpendMap[pid] || 0) + (manualSpendMap[pid] || 0) + (lpoSpendMap[pid] || 0)
    return rowToProject({ ...r, spent }, msMap[pid] || [], c.total, c.done)
  })
}

export async function getProjectById(id: number): Promise<Project | null> {
  await ensureProjectTables()

  const [row, milestoneRows, countRow, pcrSpendRow, manualSpendRow, lpoSpendRow] = await Promise.all([
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
    queryOne<Record<string, unknown>>(
      `SELECT COALESCE(SUM(amount),0) AS total FROM project_expenses WHERE project_id=$1`,
      [id]
    ).catch(() => null),
    queryOne<Record<string, unknown>>(
      `SELECT COALESCE(SUM(total),0) AS total FROM invoices WHERE project_id=$1 AND type='lpo' AND status IN ('accepted','paid')`,
      [id]
    ).catch(() => null),
  ])
  if (!row) return null
  const spent = Number(pcrSpendRow?.total || 0) + Number(manualSpendRow?.total || 0) + Number(lpoSpendRow?.total || 0)
  return rowToProject(
    { ...row, spent },
    milestoneRows.map(rowToMilestone),
    Number(countRow?.total || 0),
    Number(countRow?.done || 0),
  )
}

export async function createProject(data: {
  name: string; description: string; company: string; owner: string
  status: ProjectStatus; rag_status?: RAGStatus; start_date: string; end_date: string
  budget: number; created_by: string; branch?: string
}): Promise<Project> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO projects (name, description, company, owner, status, rag_status, start_date, end_date, budget, created_by, branch)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [data.name, data.description, data.company, data.owner, data.status,
     data.rag_status || 'not-set',
     data.start_date || null, data.end_date || null, data.budget, data.created_by, data.branch || 'kenya']
  )
  if (!row) throw new Error('Failed to create project')
  return rowToProject(row)
}

export async function updateProject(id: number, data: Partial<{
  name: string; description: string; company: string; owner: string
  status: ProjectStatus; rag_status: RAGStatus; start_date: string; end_date: string
  budget: number; spent: number
}>): Promise<Project | null> {
  await ensureProjectTables()
  const allowed = ['name','description','company','owner','status','rag_status','start_date','end_date','budget','spent']
  const fields  = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string,unknown>)[k] !== undefined)
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

export async function getMilestoneById(id: number): Promise<Milestone | null> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>('SELECT * FROM milestones WHERE id = $1', [id])
  return row ? rowToMilestone(row) : null
}

export async function createMilestone(data: {
  project_id: number; title: string; due_date: string
  start_date?: string; color?: string; amount?: number
}): Promise<Milestone> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO milestones (project_id, title, due_date, start_date, color, amount)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.project_id, data.title, data.due_date || null,
     data.start_date || null, data.color || '#2563eb', data.amount || 0]
  )
  if (!row) throw new Error('Failed to create milestone')
  return rowToMilestone(row)
}

export async function updateMilestone(id: number, data: { status?: Milestone['status']; title?: string; due_date?: string; start_date?: string; color?: string; amount?: number }): Promise<Milestone | null> {
  await ensureProjectTables()
  const allowed = ['status', 'title', 'due_date', 'start_date', 'color', 'amount']
  const fields  = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string,unknown>)[k] !== undefined)
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
    `SELECT t.id, t.particulars, t.responsible, t.status, t.due_date, t.company, t.priority,
       COALESCE(
         json_agg(
           json_build_object('id', tu.id, 'task_id', tu.task_id, 'date', tu.date,
                             'text', tu.text, 'added_by', tu.added_by, 'created_at', tu.created_at)
           ORDER BY tu.created_at DESC
         ) FILTER (WHERE tu.id IS NOT NULL),
         '[]'
       ) AS task_updates
     FROM tasks t
     LEFT JOIN task_updates tu ON tu.task_id = t.id
     WHERE t.project_id = $1
     GROUP BY t.id
     ORDER BY t.created_at DESC`,
    [projectId]
  )
}

// ─── Members ──────────────────────────────────────────────────────────────────

export async function getProjectMembers(projectId: number): Promise<ProjectMember[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM project_members WHERE project_id = $1 ORDER BY added_at ASC', [projectId]
  )
  return rows.map(rowToMember)
}

export async function addProjectMember(data: { project_id: number; user_name: string; role?: string }): Promise<ProjectMember> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_members (project_id, user_name, role)
     VALUES ($1,$2,$3)
     ON CONFLICT (project_id, user_name) DO UPDATE SET role = EXCLUDED.role
     RETURNING *`,
    [data.project_id, data.user_name, data.role || 'member']
  )
  if (!row) throw new Error('Failed to add member')
  return rowToMember(row)
}

export async function removeProjectMember(projectId: number, userName: string): Promise<boolean> {
  const rows = await query(
    'DELETE FROM project_members WHERE project_id=$1 AND user_name=$2 RETURNING id', [projectId, userName]
  )
  return rows.length > 0
}

// ─── Status Reports ───────────────────────────────────────────────────────────

export async function getStatusReports(projectId: number): Promise<StatusReport[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM project_status_reports WHERE project_id = $1 ORDER BY created_at DESC', [projectId]
  )
  return rows.map(rowToReport)
}

export async function createStatusReport(data: {
  project_id: number; author: string; rag: RAGStatus
  narrative: string; blockers: string; next_steps: string
}): Promise<StatusReport> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_status_reports (project_id, author, rag, narrative, blockers, next_steps)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.project_id, data.author, data.rag, data.narrative, data.blockers, data.next_steps]
  )
  if (!row) throw new Error('Failed to create report')
  return rowToReport(row)
}

export async function deleteStatusReport(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_status_reports WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ─── Project Expenses (manual spend entries) ──────────────────────────────────

function rowToExpense(row: Record<string, unknown>): ProjectExpense {
  return {
    id:           Number(row.id),
    project_id:   Number(row.project_id),
    description:  String(row.description || ''),
    amount:       Number(row.amount || 0),
    expense_date: row.expense_date
      ? (row.expense_date instanceof Date ? row.expense_date.toISOString() : String(row.expense_date)).slice(0, 10)
      : '',
    category:   String(row.category || 'General'),
    logged_by:  String(row.logged_by || ''),
    created_at: String(row.created_at || ''),
  }
}

export async function getProjectExpenses(projectId: number): Promise<ProjectExpense[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM project_expenses WHERE project_id = $1 ORDER BY expense_date DESC, created_at DESC', [projectId]
  )
  return rows.map(rowToExpense)
}

export async function createProjectExpense(data: {
  project_id: number; description: string; amount: number
  expense_date: string; category: string; logged_by: string
}): Promise<ProjectExpense> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_expenses (project_id, description, amount, expense_date, category, logged_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.project_id, data.description, data.amount, data.expense_date || null, data.category, data.logged_by]
  )
  if (!row) throw new Error('Failed to create expense')
  return rowToExpense(row)
}

export async function deleteProjectExpense(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_expenses WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ─── Project PCRs (read-only — petty cash requests linked to project) ─────────

export async function getProjectPCRs(projectId: number): Promise<Record<string, unknown>[]> {
  await ensureProjectTables()
  return query<Record<string, unknown>>(
    `SELECT id, req_no, employee_name, company, total_amount, status, request_date, items
     FROM petty_cash_requests WHERE project_id = $1 ORDER BY request_date DESC`,
    [projectId]
  ).catch(() => [])
}

// ─── Project LPOs (Finance invoices of type='lpo' linked to project) ──────────

export async function getProjectLPOs(projectId: number): Promise<Record<string, unknown>[]> {
  return query<Record<string, unknown>>(
    `SELECT id, doc_no, status, total, client_name AS supplier, issue_date, created_by, notes
     FROM invoices WHERE project_id = $1 AND type = 'lpo' ORDER BY created_at DESC`,
    [projectId]
  ).catch(() => [])
}

// ─── Permission helpers ────────────────────────────────────────────────────────

export async function getProjectMember(projectId: number, userName: string): Promise<ProjectMember | null> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM project_members WHERE project_id=$1 AND user_name=$2', [projectId, userName]
  )
  return row ? rowToMember(row) : null
}

export async function getProjectsForUser(userName: string, role: string, branch?: string): Promise<Project[]> {
  await ensureProjectTables()
  if (role === 'admin') return getProjects(branch)

  const [projectRows, milestoneRows, taskCounts, pcrSpendRows, manualSpendRows, lpoSpendRows] = await Promise.all([
    branch
      ? query<Record<string, unknown>>(
          `SELECT p.* FROM projects p
           INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_name = $1
           WHERE p.branch = $2
           ORDER BY p.created_at DESC`,
          [userName, branch]
        )
      : query<Record<string, unknown>>(
          `SELECT p.* FROM projects p
           INNER JOIN project_members pm ON pm.project_id = p.id AND pm.user_name = $1
           ORDER BY p.created_at DESC`,
          [userName]
        ),
    branch
      ? query<Record<string, unknown>>(
          `SELECT m.* FROM milestones m
           INNER JOIN project_members pm ON pm.project_id = m.project_id AND pm.user_name = $1
           INNER JOIN projects p ON p.id = m.project_id AND p.branch = $2
           ORDER BY m.due_date ASC NULLS LAST, m.created_at ASC`,
          [userName, branch]
        )
      : query<Record<string, unknown>>(
          `SELECT m.* FROM milestones m
           INNER JOIN project_members pm ON pm.project_id = m.project_id AND pm.user_name = $1
           ORDER BY m.due_date ASC NULLS LAST, m.created_at ASC`,
          [userName]
        ),
    query<Record<string, unknown>>(
      `SELECT t.project_id,
              COUNT(*)                                    AS total,
              COUNT(*) FILTER (WHERE t.status='resolved') AS done
       FROM tasks t
       INNER JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_name = $1
       WHERE t.project_id IS NOT NULL GROUP BY t.project_id`,
      [userName]
    ),
    query<Record<string, unknown>>(
      `SELECT pcr.project_id, COALESCE(SUM(pcr.total_amount),0) AS total
       FROM petty_cash_requests pcr
       INNER JOIN project_members pm ON pm.project_id = pcr.project_id AND pm.user_name = $1
       WHERE pcr.project_id IS NOT NULL AND pcr.status='approved' GROUP BY pcr.project_id`,
      [userName]
    ).catch(() => [] as Record<string, unknown>[]),
    query<Record<string, unknown>>(
      `SELECT pe.project_id, COALESCE(SUM(pe.amount),0) AS total
       FROM project_expenses pe
       INNER JOIN project_members pm ON pm.project_id = pe.project_id AND pm.user_name = $1
       GROUP BY pe.project_id`,
      [userName]
    ).catch(() => [] as Record<string, unknown>[]),
    query<Record<string, unknown>>(
      `SELECT i.project_id, COALESCE(SUM(i.total),0) AS total
       FROM invoices i
       INNER JOIN project_members pm ON pm.project_id = i.project_id AND pm.user_name = $1
       WHERE i.project_id IS NOT NULL AND i.type='lpo' AND i.status IN ('accepted','paid')
       GROUP BY i.project_id`,
      [userName]
    ).catch(() => [] as Record<string, unknown>[]),
  ])

  const msMap: Record<number, Milestone[]> = {}
  milestoneRows.forEach(r => {
    const pid = Number(r.project_id)
    if (!msMap[pid]) msMap[pid] = []
    msMap[pid].push(rowToMilestone(r))
  })
  const countMap: Record<number, { total: number; done: number }> = {}
  taskCounts.forEach(r => { countMap[Number(r.project_id)] = { total: Number(r.total), done: Number(r.done) } })
  const pcrSpendMap: Record<number, number> = {}
  pcrSpendRows.forEach(r => { pcrSpendMap[Number(r.project_id)] = Number(r.total) })
  const manualSpendMap: Record<number, number> = {}
  manualSpendRows.forEach(r => { manualSpendMap[Number(r.project_id)] = Number(r.total) })
  const lpoSpendMap: Record<number, number> = {}
  lpoSpendRows.forEach(r => { lpoSpendMap[Number(r.project_id)] = Number(r.total) })

  return projectRows.map(r => {
    const pid = Number(r.id)
    const c = countMap[pid] || { total: 0, done: 0 }
    const spent = (pcrSpendMap[pid] || 0) + (manualSpendMap[pid] || 0) + (lpoSpendMap[pid] || 0)
    return rowToProject({ ...r, spent }, msMap[pid] || [], c.total, c.done)
  })
}

// ─── Project Updates ──────────────────────────────────────────────────────────

function rowToUpdate(row: Record<string, unknown>, comments: ProjectUpdateComment[] = []): ProjectUpdate {
  return {
    id:         Number(row.id),
    project_id: Number(row.project_id),
    type:       (row.type as UpdateType) || 'general',
    status:     (row.status as UpdateStatus) || 'open',
    title:      String(row.title || ''),
    body:       String(row.body || ''),
    owner:      String(row.owner || ''),
    next_steps: String(row.next_steps || ''),
    posted_by:  String(row.posted_by || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
    comments,
  }
}

function rowToUpdateComment(row: Record<string, unknown>): ProjectUpdateComment {
  return {
    id:         Number(row.id),
    update_id:  Number(row.update_id),
    user_name:  String(row.user_name || ''),
    message:    String(row.message || ''),
    created_at: String(row.created_at || ''),
  }
}

export async function getProjectUpdates(projectId: number): Promise<ProjectUpdate[]> {
  await ensureProjectTables()
  const [updateRows, commentRows] = await Promise.all([
    query<Record<string, unknown>>(
      'SELECT * FROM project_updates WHERE project_id=$1 ORDER BY created_at DESC', [projectId]
    ),
    query<Record<string, unknown>>(
      `SELECT c.* FROM project_update_comments c
       INNER JOIN project_updates u ON u.id = c.update_id
       WHERE u.project_id = $1 ORDER BY c.created_at ASC`,
      [projectId]
    ),
  ])
  const commentMap: Record<number, ProjectUpdateComment[]> = {}
  commentRows.forEach(r => {
    const uid = Number(r.update_id)
    if (!commentMap[uid]) commentMap[uid] = []
    commentMap[uid].push(rowToUpdateComment(r))
  })
  return updateRows.map(r => rowToUpdate(r, commentMap[Number(r.id)] || []))
}

export async function getProjectUpdateById(id: number): Promise<ProjectUpdate | null> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM project_updates WHERE id=$1', [id]
  )
  return row ? rowToUpdate(row) : null
}

export async function createProjectUpdate(data: {
  project_id: number; type: UpdateType; title: string; body: string
  owner: string; next_steps: string; posted_by: string
}): Promise<ProjectUpdate> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_updates (project_id, type, title, body, owner, next_steps, posted_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.project_id, data.type, data.title, data.body, data.owner, data.next_steps, data.posted_by]
  )
  if (!row) throw new Error('Failed to create update')
  return rowToUpdate(row)
}

export async function updateProjectUpdate(id: number, data: Partial<{
  type: UpdateType; status: UpdateStatus; title: string; body: string
  owner: string; next_steps: string
}>): Promise<ProjectUpdate | null> {
  await ensureProjectTables()
  const allowed = ['type', 'status', 'title', 'body', 'owner', 'next_steps']
  const fields = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string, unknown>)[k] !== undefined)
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => (data as Record<string, unknown>)[f])
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE project_updates SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToUpdate(row) : null
}

export async function deleteProjectUpdate(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_updates WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

export async function addProjectUpdateComment(data: {
  update_id: number; user_name: string; message: string
}): Promise<ProjectUpdateComment> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    'INSERT INTO project_update_comments (update_id, user_name, message) VALUES ($1,$2,$3) RETURNING *',
    [data.update_id, data.user_name, data.message]
  )
  if (!row) throw new Error('Failed to add comment')
  return rowToUpdateComment(row)
}

export async function deleteProjectUpdateComment(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_update_comments WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ─── Project Meetings ─────────────────────────────────────────────────────────

function rowToMeetingActionTask(row: Record<string, unknown>): MeetingActionTask {
  return {
    id:          Number(row.id),
    meeting_id:  Number(row.meeting_id),
    action_text: String(row.action_text || ''),
    task_id:     Number(row.task_id),
    created_by:  String(row.created_by || ''),
    created_at:  String(row.created_at || ''),
  }
}

function rowToMeeting(row: Record<string, unknown>, actionTasks: MeetingActionTask[] = []): ProjectMeeting {
  return {
    id:            Number(row.id),
    project_id:    Number(row.project_id),
    title:         String(row.title || ''),
    meeting_date:  row.meeting_date
      ? (row.meeting_date instanceof Date ? row.meeting_date.toISOString() : String(row.meeting_date)).slice(0, 10)
      : '',
    attendees:     String(row.attendees || ''),
    agenda:        String(row.agenda || ''),
    notes:         String(row.notes || ''),
    action_points: String(row.action_points || ''),
    logged_by:     String(row.logged_by || ''),
    created_at:    String(row.created_at || ''),
    action_tasks:  actionTasks,
  }
}

export async function getProjectMeetings(projectId: number): Promise<ProjectMeeting[]> {
  await ensureProjectTables()
  const [meetingRows, actionTaskRows] = await Promise.all([
    query<Record<string, unknown>>(
      'SELECT * FROM project_meetings WHERE project_id=$1 ORDER BY meeting_date DESC, created_at DESC', [projectId]
    ),
    query<Record<string, unknown>>(
      `SELECT mat.* FROM meeting_action_tasks mat
       INNER JOIN project_meetings pm ON pm.id = mat.meeting_id
       WHERE pm.project_id = $1`,
      [projectId]
    ).catch(() => [] as Record<string, unknown>[]),
  ])
  const actionMap: Record<number, MeetingActionTask[]> = {}
  actionTaskRows.forEach(r => {
    const mid = Number(r.meeting_id)
    if (!actionMap[mid]) actionMap[mid] = []
    actionMap[mid].push(rowToMeetingActionTask(r))
  })
  return meetingRows.map(r => rowToMeeting(r, actionMap[Number(r.id)] || []))
}

export async function createProjectMeeting(data: {
  project_id: number; title: string; meeting_date: string; attendees: string
  agenda: string; notes: string; action_points: string; logged_by: string
}): Promise<ProjectMeeting> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_meetings (project_id, title, meeting_date, attendees, agenda, notes, action_points, logged_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.project_id, data.title, data.meeting_date || null, data.attendees, data.agenda, data.notes, data.action_points, data.logged_by]
  )
  if (!row) throw new Error('Failed to create meeting')
  return rowToMeeting(row)
}

export async function updateProjectMeeting(id: number, data: Partial<{
  title: string; meeting_date: string; attendees: string
  agenda: string; notes: string; action_points: string
}>): Promise<ProjectMeeting | null> {
  await ensureProjectTables()
  const allowed = ['title', 'meeting_date', 'attendees', 'agenda', 'notes', 'action_points']
  const fields = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string, unknown>)[k] !== undefined)
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if (f === 'meeting_date' && !v) return null
    return v
  })
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE project_meetings SET ${set} WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToMeeting(row) : null
}

export async function deleteProjectMeeting(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_meetings WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ─── Meeting Action Tasks (action-point → task traceability) ──────────────────

export async function getMeetingById(meetingId: number, projectId: number): Promise<ProjectMeeting | null> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM project_meetings WHERE id=$1 AND project_id=$2', [meetingId, projectId]
  )
  return row ? rowToMeeting(row) : null
}

export async function getMeetingActionTasks(meetingId: number): Promise<MeetingActionTask[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM meeting_action_tasks WHERE meeting_id=$1 ORDER BY created_at ASC', [meetingId]
  )
  return rows.map(rowToMeetingActionTask)
}

// ─── Decisions ────────────────────────────────────────────────────────────────

function rowToDecision(row: Record<string, unknown>): ProjectDecision {
  return {
    id:            Number(row.id),
    project_id:    Number(row.project_id),
    title:         String(row.title || ''),
    description:   String(row.description || ''),
    status:        (row.status as DecisionStatus) || 'pending',
    owner:         String(row.owner || ''),
    decision_date: row.decision_date
      ? (row.decision_date instanceof Date ? row.decision_date.toISOString() : String(row.decision_date)).slice(0, 10)
      : '',
    source:        String(row.source || ''),
    created_by:    String(row.created_by || ''),
    created_at:    String(row.created_at || ''),
    updated_at:    String(row.updated_at || ''),
  }
}

export async function getProjectDecisions(projectId: number): Promise<ProjectDecision[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM project_decisions WHERE project_id=$1 ORDER BY created_at DESC', [projectId]
  )
  return rows.map(rowToDecision)
}

export async function getDecisionById(id: number, projectId: number): Promise<ProjectDecision | null> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM project_decisions WHERE id=$1 AND project_id=$2', [id, projectId]
  )
  return row ? rowToDecision(row) : null
}

export async function createProjectDecision(data: {
  project_id: number; title: string; description: string; status: DecisionStatus
  owner: string; decision_date: string; source: string; created_by: string
}): Promise<ProjectDecision> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_decisions (project_id, title, description, status, owner, decision_date, source, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.project_id, data.title, data.description, data.status, data.owner,
     data.decision_date || null, data.source, data.created_by]
  )
  if (!row) throw new Error('Failed to create decision')
  return rowToDecision(row)
}

export async function updateProjectDecision(id: number, data: Partial<{
  title: string; description: string; status: DecisionStatus
  owner: string; decision_date: string; source: string
}>): Promise<ProjectDecision | null> {
  await ensureProjectTables()
  const allowed = ['title', 'description', 'status', 'owner', 'decision_date', 'source']
  const fields = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string, unknown>)[k] !== undefined)
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if (f === 'decision_date' && !v) return null
    return v
  })
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE project_decisions SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToDecision(row) : null
}

export async function deleteProjectDecision(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_decisions WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

// ─── Risks & Issues ───────────────────────────────────────────────────────────

function rowToRisk(row: Record<string, unknown>): ProjectRisk {
  return {
    id:          Number(row.id),
    project_id:  Number(row.project_id),
    type:        (row.type as RiskType) || 'risk',
    title:       String(row.title || ''),
    description: String(row.description || ''),
    owner:       String(row.owner || ''),
    severity:    (row.severity as RiskSeverity) || 'medium',
    status:      (row.status as RiskStatus) || 'open',
    mitigation:  String(row.mitigation || ''),
    target_date: row.target_date
      ? (row.target_date instanceof Date ? row.target_date.toISOString() : String(row.target_date)).slice(0, 10)
      : '',
    created_by:  String(row.created_by || ''),
    created_at:  String(row.created_at || ''),
    updated_at:  String(row.updated_at || ''),
  }
}

export async function getProjectRisks(projectId: number): Promise<ProjectRisk[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM project_risks WHERE project_id=$1 ORDER BY
      CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
      created_at DESC`,
    [projectId]
  )
  return rows.map(rowToRisk)
}

export async function getRiskById(id: number, projectId: number): Promise<ProjectRisk | null> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    'SELECT * FROM project_risks WHERE id=$1 AND project_id=$2', [id, projectId]
  )
  return row ? rowToRisk(row) : null
}

export async function createProjectRisk(data: {
  project_id: number; type: RiskType; title: string; description: string
  owner: string; severity: RiskSeverity; mitigation: string; target_date: string; created_by: string
}): Promise<ProjectRisk> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO project_risks (project_id, type, title, description, owner, severity, mitigation, target_date, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.project_id, data.type, data.title, data.description, data.owner,
     data.severity, data.mitigation, data.target_date || null, data.created_by]
  )
  if (!row) throw new Error('Failed to create risk/issue')
  return rowToRisk(row)
}

export async function updateProjectRisk(id: number, data: Partial<{
  type: RiskType; title: string; description: string; owner: string
  severity: RiskSeverity; status: RiskStatus; mitigation: string; target_date: string
}>): Promise<ProjectRisk | null> {
  await ensureProjectTables()
  const allowed = ['type', 'title', 'description', 'owner', 'severity', 'status', 'mitigation', 'target_date']
  const fields = Object.keys(data).filter(k => allowed.includes(k) && (data as Record<string, unknown>)[k] !== undefined)
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if (f === 'target_date' && !v) return null
    return v
  })
  const row = await queryOne<Record<string, unknown>>(
    `UPDATE project_risks SET ${set}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...values]
  )
  return row ? rowToRisk(row) : null
}

export async function deleteProjectRisk(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM project_risks WHERE id=$1 RETURNING id', [id])
  return rows.length > 0
}

export async function createMeetingActionTask(data: {
  meeting_id: number; action_text: string; task_id: number; created_by: string
}): Promise<MeetingActionTask> {
  await ensureProjectTables()
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO meeting_action_tasks (meeting_id, action_text, task_id, created_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (meeting_id, action_text) DO NOTHING
     RETURNING *`,
    [data.meeting_id, data.action_text.slice(0, 500), data.task_id, data.created_by]
  )
  if (!row) throw new Error('Action point already has a task — duplicate prevented')
  return rowToMeetingActionTask(row)
}

// ─── Project Activity ─────────────────────────────────────────────────────────

function rowToActivity(row: Record<string, unknown>): ProjectActivity {
  return {
    id:          Number(row.id),
    project_id:  Number(row.project_id),
    actor:       String(row.actor || ''),
    action_type: String(row.action_type || ''),
    entity_type: String(row.entity_type || ''),
    entity_id:   row.entity_id !== null && row.entity_id !== undefined ? Number(row.entity_id) : null,
    description: String(row.description || ''),
    metadata:    row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata as Record<string, unknown>) : null,
    created_at:  String(row.created_at || ''),
  }
}

export async function createProjectActivity(data: {
  project_id:  number
  actor:       string
  action_type: string
  entity_type: string
  entity_id?:  number | null
  description: string
  metadata?:   Record<string, unknown>
}): Promise<void> {
  try {
    await ensureProjectTables()
    await execute(
      `INSERT INTO project_activity (project_id, actor, action_type, entity_type, entity_id, description, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [data.project_id, data.actor, data.action_type, data.entity_type,
       data.entity_id ?? null,
       data.description,
       data.metadata ? JSON.stringify(data.metadata) : null]
    )
  } catch (err) {
    console.error('[projectActivity] createProjectActivity failed:', err)
  }
}

export async function getProjectActivity(projectId: number, limit = 100): Promise<ProjectActivity[]> {
  await ensureProjectTables()
  const rows = await query<Record<string, unknown>>(
    `SELECT * FROM project_activity WHERE project_id=$1 ORDER BY created_at DESC LIMIT $2`,
    [projectId, limit]
  )
  return rows.map(rowToActivity)
}
