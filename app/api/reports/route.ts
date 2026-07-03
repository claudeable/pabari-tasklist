import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { getTasks } from '@/lib/db'
import { createReport, getReports } from '@/lib/reports'
import { TaskStatus, STATUS_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

const MONTHS: Record<string, number> = {
  Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5,
  Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11,
}

function parseTaskDate(dateStr: string): Date | null {
  if (!dateStr) return null
  const m = dateStr.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/)
  if (!m) return null
  const month = MONTHS[m[2]]
  if (month === undefined) return null
  return new Date(2000 + parseInt(m[3]), month, parseInt(m[1]))
}

function nameMatch(responsible: string, person: string): boolean {
  if (!person) return true
  return responsible.split(/\s*[&/]\s*/).some(n => n.trim().toLowerCase() === person.toLowerCase())
}

function buildReportName(filters: Record<string, string>): string {
  const parts: string[] = []
  parts.push(filters.company || 'All Companies')
  if (filters.section)  parts.push(filters.section.split(' - ').pop() ?? filters.section)
  if (filters.priority) parts.push(filters.priority.charAt(0).toUpperCase() + filters.priority.slice(1) + ' Priority')
  if (filters.status)   parts.push(STATUS_LABELS[filters.status as TaskStatus] ?? filters.status)
  if (filters.person)   parts.push(filters.person)
  if (filters.dateFrom || filters.dateTo) {
    const from = filters.dateFrom || '…'
    const to   = filters.dateTo   || '…'
    parts.push(`${from} to ${to}`)
  }
  parts.push(new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }))
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
  const rawTasks = await getTasks()
  const userCompanies = Array.isArray(user.companies) ? user.companies : ['ALL']
  const allTasks = userCompanies.includes('ALL')
    ? rawTasks
    : rawTasks.filter(t => userCompanies.includes(t.company))

  const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null
  const toDate   = filters.dateTo   ? new Date(filters.dateTo)   : null

  const matched = allTasks.filter(t => {
    if (filters.company  && t.company  !== filters.company)                return false
    if (filters.section  && t.section  !== filters.section)                return false
    if (filters.status   && t.status   !== filters.status)                 return false
    if (filters.priority && t.priority !== filters.priority)               return false
    if (filters.person   && !nameMatch(t.responsible, filters.person))     return false
    if (fromDate || toDate) {
      const td = parseTaskDate(t.date)
      if (td) {
        if (fromDate && td < fromDate) return false
        if (toDate   && td > toDate)   return false
      }
    }
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
