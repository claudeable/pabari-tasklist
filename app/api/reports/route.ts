import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getTasks } from '@/lib/db'
import { createReport, getReports } from '@/lib/reports'
import { TaskStatus, STATUS_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

function nameMatch(responsible: string, person: string): boolean {
  if (!person) return true
  return responsible.split(/\s*[&/]\s*/).some(n => n.trim().toLowerCase() === person.toLowerCase())
}

function buildReportName(filters: Record<string, string>): string {
  const parts: string[] = []
  parts.push(filters.company || 'All Companies')
  if (filters.section) parts.push(filters.section.split(' - ').pop() ?? filters.section)
  if (filters.status)  parts.push(STATUS_LABELS[filters.status as TaskStatus] ?? filters.status)
  if (filters.person)  parts.push(filters.person)
  parts.push(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }))
  return parts.join(' — ')
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const reports = await getReports()
  return NextResponse.json(reports)
}

export async function POST(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const filters = await req.json()
  const allTasks = await getTasks()

  const matched = allTasks.filter(t => {
    if (filters.company && t.company !== filters.company)                  return false
    if (filters.section  && t.section  !== filters.section)                return false
    if (filters.status   && t.status   !== filters.status)                 return false
    if (filters.person   && !nameMatch(t.responsible, filters.person))     return false
    return true
  })

  const report = await createReport({
    name:         buildReportName(filters),
    generated_by: user.name,
    filters,
    task_count:   matched.length,
  })

  return NextResponse.json({ report, tasks: matched })
}
