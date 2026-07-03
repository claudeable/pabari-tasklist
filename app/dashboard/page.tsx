import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyToken } from '@/lib/auth'
import { getTasks } from '@/lib/db'
import { getUsers } from '@/lib/users'
import Dashboard from '@/components/Dashboard'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const currentUser = session?.value ? await verifyToken(session.value) : null
  if (!currentUser) redirect('/login')
  if (currentUser.role === 'staff') redirect('/tasks')

  const isKiscolOnly = !currentUser.companies.includes('ALL') && currentUser.companies.includes('KISCOL')

  const [allTasks, users] = await Promise.all([getTasks(), getUsers()])
  const tasks = isKiscolOnly ? allTasks.filter(t => t.company === 'KISCOL') : allTasks

  // ── Name → department map ───────────────────────────────────────
  const nameToDept: Record<string, string> = {}
  for (const u of users) {
    nameToDept[u.name.toLowerCase()] = u.department
    nameToDept[u.name.split(' ')[0].toLowerCase()] = u.department
  }

  // ── KPI by status ──────────────────────────────────────────────
  const byStatus: Record<string, number> = {}
  for (const t of tasks) {
    byStatus[t.status] = (byStatus[t.status] || 0) + 1
  }

  // ── By department (open + pending review) ──────────────────────
  const deptMap: Record<string, { open: number; pendingReview: number }> = {}
  for (const t of tasks) {
    if (t.status === 'resolved' || t.status === 'expired') continue
    const names = t.responsible.split(/\s*[&/]\s*/).map((n: string) => n.trim()).filter(Boolean)
    for (const name of names) {
      const dept = nameToDept[name.toLowerCase()] || nameToDept[name.split(' ')[0].toLowerCase()] || null
      if (!dept || dept === 'System' || dept === 'Director') continue
      if (!deptMap[dept]) deptMap[dept] = { open: 0, pendingReview: 0 }
      deptMap[dept].open++
      if (t.status === 'awaiting-hod-approval' || t.status === 'awaiting-hk-approval') {
        deptMap[dept].pendingReview++
      }
    }
  }
  const byDepartment = Object.entries(deptMap)
    .map(([dept, v]) => ({ dept, ...v }))
    .sort((a, b) => b.open - a.open)

  // ── By company ─────────────────────────────────────────────────
  const companyMap: Record<string, { total: number; action: number; pending: number; review: number; resolved: number; expired: number }> = {}
  for (const t of tasks) {
    if (!companyMap[t.company]) companyMap[t.company] = { total:0, action:0, pending:0, review:0, resolved:0, expired:0 }
    const c = companyMap[t.company]
    c.total++
    if (t.status === 'action-required')    c.action++
    if (t.status === 'pending-discussion') c.pending++
    if (t.status === 'in-review')          c.review++
    if (t.status === 'resolved')           c.resolved++
    if (t.status === 'expired')            c.expired++
  }
  const byCompany = Object.entries(companyMap)
    .map(([company, v]) => ({ company, ...v }))
    .sort((a, b) => b.total - a.total)

  // ── By person (open tasks) ─────────────────────────────────────
  const personMap: Record<string, { open: number; action: number }> = {}
  for (const t of tasks) {
    if (t.status === 'resolved' || t.status === 'expired') continue
    const names = t.responsible.split(/\s*[&/]\s*/).map((n: string) => n.trim()).filter(Boolean)
    for (const name of names) {
      if (!personMap[name]) personMap[name] = { open: 0, action: 0 }
      personMap[name].open++
      if (t.status === 'action-required') personMap[name].action++
    }
  }
  const byPerson = Object.entries(personMap)
    .map(([name, v]) => ({ name, ...v }))
    .filter(p => p.name.length > 1)
    .sort((a, b) => b.open - a.open)
    .slice(0, 12)

  return (
    <Dashboard
      currentUser={currentUser}
      stats={{
        total:        tasks.length,
        open:         tasks.filter(t => t.status !== 'resolved' && t.status !== 'expired').length,
        byStatus,
        byCompany,
        byPerson,
        byDepartment,
      }}
    />
  )
}
