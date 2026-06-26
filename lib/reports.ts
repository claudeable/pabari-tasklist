import { query, queryOne, execute } from './database'

export interface ReportFilters {
  company:  string
  section:  string
  status:   string
  person:   string
  [key: string]: string
}

export interface Report {
  id:           string
  name:         string
  generated_by: string
  filters:      ReportFilters
  task_count:   number
  created_at:   string
}

function rowToReport(r: Record<string, unknown>): Report {
  return {
    id:           String(r.id),
    name:         String(r.name),
    generated_by: String(r.generated_by),
    filters:      (r.filters as ReportFilters) ?? {},
    task_count:   Number(r.task_count) || 0,
    created_at:   String(r.created_at),
  }
}

export async function getReports(): Promise<Report[]> {
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM reports ORDER BY created_at DESC'
  )
  return rows.map(rowToReport)
}

export async function createReport(data: Omit<Report, 'id' | 'created_at'>): Promise<Report> {
  const row = await queryOne<Record<string, unknown>>(
    `INSERT INTO reports (name, generated_by, filters, task_count)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [data.name, data.generated_by, JSON.stringify(data.filters), data.task_count]
  )
  if (!row) throw new Error('Failed to create report')
  return rowToReport(row)
}

export async function deleteReport(id: string): Promise<boolean> {
  const rows = await query('DELETE FROM reports WHERE id = $1 RETURNING id', [id])
  return rows.length > 0
}
