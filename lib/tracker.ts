import { query, queryOne, execute } from './database'

let ready = false

async function ensureTables() {
  if (ready) return
  await execute(`
    CREATE TABLE IF NOT EXISTS tracker_projects (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      company     TEXT NOT NULL DEFAULT '',
      owner       TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'active',
      rag_status  TEXT NOT NULL DEFAULT 'not-set',
      start_date  DATE,
      end_date    DATE,
      created_by  TEXT NOT NULL DEFAULT '',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tracker_milestones (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      start_date  DATE,
      end_date    DATE,
      status      TEXT NOT NULL DEFAULT 'pending',
      color       TEXT NOT NULL DEFAULT '#2563eb',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tracker_updates (
      id          SERIAL PRIMARY KEY,
      project_id  INTEGER NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
      posted_by   TEXT NOT NULL DEFAULT '',
      update_type TEXT NOT NULL DEFAULT 'progress',
      body        TEXT NOT NULL DEFAULT '',
      next_steps  TEXT NOT NULL DEFAULT '',
      owner       TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'open',
      update_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tracker_update_comments (
      id        SERIAL PRIMARY KEY,
      update_id INTEGER NOT NULL REFERENCES tracker_updates(id) ON DELETE CASCADE,
      posted_by TEXT NOT NULL DEFAULT '',
      body      TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await execute(`
    CREATE TABLE IF NOT EXISTS tracker_meetings (
      id           SERIAL PRIMARY KEY,
      project_id   INTEGER NOT NULL REFERENCES tracker_projects(id) ON DELETE CASCADE,
      title        TEXT NOT NULL DEFAULT '',
      meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
      attendees    TEXT NOT NULL DEFAULT '',
      agenda       TEXT NOT NULL DEFAULT '',
      notes        TEXT NOT NULL DEFAULT '',
      action_points TEXT NOT NULL DEFAULT '',
      created_by   TEXT NOT NULL DEFAULT '',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  ready = true
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TrackerProject {
  id: number; name: string; description: string; company: string; owner: string
  status: string; rag_status: string; start_date: string; end_date: string
  created_by: string; created_at: string
  milestones?: TrackerMilestone[]
}

export interface TrackerMilestone {
  id: number; project_id: number; title: string; start_date: string; end_date: string
  status: string; color: string; created_at: string
}

export interface TrackerUpdateComment {
  id: number; update_id: number; posted_by: string; body: string; created_at: string
}

export interface TrackerUpdate {
  id: number; project_id: number; posted_by: string; update_type: string
  body: string; next_steps: string; owner: string; status: string
  update_date: string; created_at: string
  comments: TrackerUpdateComment[]
}

export interface TrackerMeeting {
  id: number; project_id: number; title: string; meeting_date: string
  attendees: string; agenda: string; notes: string; action_points: string
  created_by: string; created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toProject(r: Record<string, unknown>): TrackerProject {
  return {
    id: Number(r.id), name: String(r.name || ''), description: String(r.description || ''),
    company: String(r.company || ''), owner: String(r.owner || ''),
    status: String(r.status || 'active'), rag_status: String(r.rag_status || 'not-set'),
    start_date: r.start_date ? String(r.start_date).slice(0, 10) : '',
    end_date:   r.end_date   ? String(r.end_date).slice(0, 10)   : '',
    created_by: String(r.created_by || ''), created_at: String(r.created_at || ''),
  }
}

function toMilestone(r: Record<string, unknown>): TrackerMilestone {
  return {
    id: Number(r.id), project_id: Number(r.project_id), title: String(r.title || ''),
    start_date: r.start_date ? String(r.start_date).slice(0, 10) : '',
    end_date:   r.end_date   ? String(r.end_date).slice(0, 10)   : '',
    status: String(r.status || 'pending'), color: String(r.color || '#2563eb'),
    created_at: String(r.created_at || ''),
  }
}

function toUpdate(r: Record<string, unknown>, comments: TrackerUpdateComment[] = []): TrackerUpdate {
  return {
    id: Number(r.id), project_id: Number(r.project_id),
    posted_by: String(r.posted_by || ''), update_type: String(r.update_type || 'progress'),
    body: String(r.body || ''), next_steps: String(r.next_steps || ''),
    owner: String(r.owner || ''), status: String(r.status || 'open'),
    update_date: r.update_date ? String(r.update_date).slice(0, 10) : '',
    created_at: String(r.created_at || ''),
    comments,
  }
}

function toComment(r: Record<string, unknown>): TrackerUpdateComment {
  return {
    id: Number(r.id), update_id: Number(r.update_id),
    posted_by: String(r.posted_by || ''), body: String(r.body || ''),
    created_at: String(r.created_at || ''),
  }
}

function toMeeting(r: Record<string, unknown>): TrackerMeeting {
  return {
    id: Number(r.id), project_id: Number(r.project_id),
    title: String(r.title || ''), meeting_date: r.meeting_date ? String(r.meeting_date).slice(0, 10) : '',
    attendees: String(r.attendees || ''), agenda: String(r.agenda || ''),
    notes: String(r.notes || ''), action_points: String(r.action_points || ''),
    created_by: String(r.created_by || ''), created_at: String(r.created_at || ''),
  }
}

// ── Projects ──────────────────────────────────────────────────────────────────

export async function getTrackerProjects(): Promise<TrackerProject[]> {
  await ensureTables()
  const [rows, msRows] = await Promise.all([
    query('SELECT * FROM tracker_projects ORDER BY created_at DESC'),
    query('SELECT * FROM tracker_milestones ORDER BY start_date ASC NULLS LAST'),
  ])
  const msMap: Record<number, TrackerMilestone[]> = {}
  msRows.forEach(r => { const pid = Number(r.project_id); (msMap[pid] ??= []).push(toMilestone(r)) })
  return rows.map(r => ({ ...toProject(r), milestones: msMap[Number(r.id)] || [] }))
}

export async function getTrackerProject(id: number): Promise<TrackerProject | null> {
  await ensureTables()
  const r = await queryOne('SELECT * FROM tracker_projects WHERE id = $1', [id])
  if (!r) return null
  const ms = await query('SELECT * FROM tracker_milestones WHERE project_id = $1 ORDER BY start_date ASC NULLS LAST', [id])
  return { ...toProject(r), milestones: ms.map(toMilestone) }
}

export async function createTrackerProject(data: {
  name: string; description: string; company: string; owner: string
  status: string; rag_status: string; start_date: string; end_date: string; created_by: string
}): Promise<TrackerProject> {
  await ensureTables()
  const r = await queryOne(
    `INSERT INTO tracker_projects (name,description,company,owner,status,rag_status,start_date,end_date,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.name, data.description, data.company, data.owner, data.status,
     data.rag_status, data.start_date || null, data.end_date || null, data.created_by]
  )
  if (!r) throw new Error('Failed to create project')
  return { ...toProject(r), milestones: [] }
}

export async function updateTrackerProject(id: number, data: Partial<{
  name: string; description: string; company: string; owner: string
  status: string; rag_status: string; start_date: string; end_date: string
}>): Promise<TrackerProject | null> {
  await ensureTables()
  const allowed = ['name','description','company','owner','status','rag_status','start_date','end_date']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if ((f === 'start_date' || f === 'end_date') && !v) return null
    return v
  })
  const r = await queryOne(`UPDATE tracker_projects SET ${set} WHERE id = $1 RETURNING *`, [id, ...values])
  return r ? { ...toProject(r), milestones: [] } : null
}

export async function deleteTrackerProject(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM tracker_projects WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ── Milestones ────────────────────────────────────────────────────────────────

export async function createTrackerMilestone(data: {
  project_id: number; title: string; start_date: string; end_date: string; status: string; color: string
}): Promise<TrackerMilestone> {
  await ensureTables()
  const r = await queryOne(
    `INSERT INTO tracker_milestones (project_id,title,start_date,end_date,status,color)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [data.project_id, data.title, data.start_date || null, data.end_date || null, data.status, data.color]
  )
  if (!r) throw new Error('Failed')
  return toMilestone(r)
}

export async function updateTrackerMilestone(id: number, data: Partial<{
  title: string; start_date: string; end_date: string; status: string; color: string
}>): Promise<TrackerMilestone | null> {
  const allowed = ['title','start_date','end_date','status','color']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => {
    const v = (data as Record<string, unknown>)[f]
    if ((f === 'start_date' || f === 'end_date') && !v) return null
    return v
  })
  const r = await queryOne(`UPDATE tracker_milestones SET ${set} WHERE id = $1 RETURNING *`, [id, ...values])
  return r ? toMilestone(r) : null
}

export async function deleteTrackerMilestone(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM tracker_milestones WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

// ── Updates ───────────────────────────────────────────────────────────────────

export async function getTrackerUpdates(projectId: number): Promise<TrackerUpdate[]> {
  await ensureTables()
  const [rows, commentRows] = await Promise.all([
    query('SELECT * FROM tracker_updates WHERE project_id = $1 ORDER BY update_date DESC, created_at DESC', [projectId]),
    query('SELECT * FROM tracker_update_comments WHERE update_id IN (SELECT id FROM tracker_updates WHERE project_id = $1) ORDER BY created_at ASC', [projectId]),
  ])
  const cMap: Record<number, TrackerUpdateComment[]> = {}
  commentRows.forEach(r => { const uid = Number(r.update_id); (cMap[uid] ??= []).push(toComment(r)) })
  return rows.map(r => toUpdate(r, cMap[Number(r.id)] || []))
}

export async function createTrackerUpdate(data: {
  project_id: number; posted_by: string; update_type: string; body: string
  next_steps: string; owner: string; update_date: string
}): Promise<TrackerUpdate> {
  await ensureTables()
  const r = await queryOne(
    `INSERT INTO tracker_updates (project_id,posted_by,update_type,body,next_steps,owner,update_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.project_id, data.posted_by, data.update_type, data.body,
     data.next_steps, data.owner, data.update_date || null]
  )
  if (!r) throw new Error('Failed')
  return toUpdate(r, [])
}

export async function updateTrackerUpdate(id: number, data: Partial<{
  update_type: string; body: string; next_steps: string; owner: string
  status: string; update_date: string
}>): Promise<TrackerUpdate | null> {
  const allowed = ['update_type','body','next_steps','owner','status','update_date']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => (data as Record<string, unknown>)[f])
  const r = await queryOne(`UPDATE tracker_updates SET ${set} WHERE id = $1 RETURNING *`, [id, ...values])
  return r ? toUpdate(r, []) : null
}

export async function deleteTrackerUpdate(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM tracker_updates WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}

export async function addTrackerUpdateComment(data: {
  update_id: number; posted_by: string; body: string
}): Promise<TrackerUpdateComment> {
  await ensureTables()
  const r = await queryOne(
    `INSERT INTO tracker_update_comments (update_id,posted_by,body) VALUES ($1,$2,$3) RETURNING *`,
    [data.update_id, data.posted_by, data.body]
  )
  if (!r) throw new Error('Failed')
  return toComment(r)
}

// ── Meetings ──────────────────────────────────────────────────────────────────

export async function getTrackerMeetings(projectId: number): Promise<TrackerMeeting[]> {
  await ensureTables()
  const rows = await query('SELECT * FROM tracker_meetings WHERE project_id = $1 ORDER BY meeting_date DESC', [projectId])
  return rows.map(toMeeting)
}

export async function createTrackerMeeting(data: {
  project_id: number; title: string; meeting_date: string; attendees: string
  agenda: string; notes: string; action_points: string; created_by: string
}): Promise<TrackerMeeting> {
  await ensureTables()
  const r = await queryOne(
    `INSERT INTO tracker_meetings (project_id,title,meeting_date,attendees,agenda,notes,action_points,created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [data.project_id, data.title, data.meeting_date || null, data.attendees,
     data.agenda, data.notes, data.action_points, data.created_by]
  )
  if (!r) throw new Error('Failed')
  return toMeeting(r)
}

export async function updateTrackerMeeting(id: number, data: Partial<{
  title: string; meeting_date: string; attendees: string
  agenda: string; notes: string; action_points: string
}>): Promise<TrackerMeeting | null> {
  const allowed = ['title','meeting_date','attendees','agenda','notes','action_points']
  const fields = Object.keys(data).filter(k => allowed.includes(k))
  if (!fields.length) return null
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ')
  const values = fields.map(f => (data as Record<string, unknown>)[f])
  const r = await queryOne(`UPDATE tracker_meetings SET ${set} WHERE id = $1 RETURNING *`, [id, ...values])
  return r ? toMeeting(r) : null
}

export async function deleteTrackerMeeting(id: number): Promise<boolean> {
  const rows = await query('DELETE FROM tracker_meetings WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}
