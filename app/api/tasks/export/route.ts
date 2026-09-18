import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getTasks } from '@/lib/db'
import { verifyToken } from '@/lib/auth'
import { FINANCE_VISIBLE_EMAILS, STATUS_LABELS } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get('pabari-session')?.value
  const user  = token ? await verifyToken(token) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let tasks = await getTasks()

  // Apply same finance filter as the main tasks endpoint
  if (!FINANCE_VISIBLE_EMAILS.has((user.email || '').toLowerCase())) {
    const userName  = (user.name || '').toLowerCase()
    const firstName = userName.split(' ')[0]
    const userEmail = (user.email || '').toLowerCase()
    tasks = tasks.filter(t => {
      if (t.category !== 'Finance') return true
      const resp = t.responsible.toLowerCase()
      return resp === userName || resp === firstName || resp.startsWith(firstName) || resp === userEmail
    })
  }

  // Sort updates newest-first within each task (already done server-side but ensure it)
  const rows = tasks.map(t => {
    const updates = [...(t.task_updates ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    const latestUpdate = updates[0]
      ? `[${updates[0].date}] ${updates[0].text}`
      : ''
    const allUpdates = updates
      .map(u => `[${u.date}${u.added_by ? ' – ' + u.added_by : ''}] ${u.text}`)
      .join('\n\n')

    return {
      'ID':              t.id,
      'S.No':            t.sno,
      'Date':            t.date,
      'Company':         t.company,
      'Section':         t.section,
      'Category':        t.category,
      'Particulars':     t.particulars,
      'Latest Update':   latestUpdate,
      'All Updates':     allUpdates,
      'Responsible':     t.responsible,
      'Payment':         t.payment,
      'Status':          STATUS_LABELS[t.status] ?? t.status,
      'Priority':        t.priority.charAt(0).toUpperCase() + t.priority.slice(1),
      'Due Date':        t.due_date,
      'Recurrence':      t.recurrence === 'none' ? '' : t.recurrence,
      'HK Comment':      t.hk_comment,
      'HOD Comment':     t.hod_comment,
      'Status WK':       t.status_wk,
      'Approval Type':   t.approval_type,
      'Approval Status': t.approval_status,
      'Approved By':     t.approved_by,
      'Approved At':     t.approved_at,
      'Legal Review':    t.legal_review ? 'Yes' : 'No',
      'Legal Comment':   t.legal_comment,
      'Created By':      t.created_by,
      'Created At':      t.created_at ? new Date(t.created_at).toLocaleString('en-GB') : '',
      'Updated At':      t.updated_at ? new Date(t.updated_at).toLocaleString('en-GB') : '',
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 10 },  // ID
    { wch: 6  },  // S.No
    { wch: 12 },  // Date
    { wch: 14 },  // Company
    { wch: 28 },  // Section
    { wch: 14 },  // Category
    { wch: 50 },  // Particulars
    { wch: 60 },  // Latest Update
    { wch: 80 },  // All Updates
    { wch: 16 },  // Responsible
    { wch: 12 },  // Payment
    { wch: 22 },  // Status
    { wch: 10 },  // Priority
    { wch: 12 },  // Due Date
    { wch: 14 },  // Recurrence
    { wch: 40 },  // HK Comment
    { wch: 40 },  // HOD Comment
    { wch: 20 },  // Status WK
    { wch: 16 },  // Approval Type
    { wch: 16 },  // Approval Status
    { wch: 16 },  // Approved By
    { wch: 16 },  // Approved At
    { wch: 14 },  // Legal Review
    { wch: 40 },  // Legal Comment
    { wch: 16 },  // Created By
    { wch: 20 },  // Created At
    { wch: 20 },  // Updated At
  ]

  XLSX.utils.book_append_sheet(wb, ws, 'Tasks')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const today = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="tasks-${today}.xlsx"`,
    },
  })
}
