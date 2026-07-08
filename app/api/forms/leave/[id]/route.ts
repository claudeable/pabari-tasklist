import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { approveByHR, approveByHK, rejectLeave, deleteLeaveRequest, getAllLeaveRequests } from '@/lib/leave'
import { getUserByName } from '@/lib/users'
import { postDMMessage } from '@/lib/chat'
import { logActivity } from '@/lib/activityLog'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safeInt = (v: unknown) => { const n = parseInt(String(v ?? ''), 10); return isNaN(n) ? 0 : n }
  const id  = safeInt(params.id)
  const uid = safeInt(user.id)
  const { action, notes } = await req.json()

  const isHR    = user.department === 'HR' || user.role === 'admin' || user.role === 'director'
  const isAdmin = user.role === 'admin' || user.role === 'director'

  // Fetch the leave request so we know who to notify
  const all     = await getAllLeaveRequests()
  const request = all.find(r => r.id === id)

  if (action === 'hr_approve') {
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveByHR(id, uid, notes || '')
    if (request) {
      logActivity(user.email, user.name, 'leave_hr_approved',
        `HR approved ${request.employee_name}'s ${request.leave_type} leave (${request.date_from} – ${request.date_to})`).catch(() => {})
      notifyEmployee(
        user, request.employee_name,
        `✅ Your leave request (${request.date_from} – ${request.date_to}) has been approved by HR and is now pending final approval from Harshil.${notes ? `\n\nHR note: ${notes}` : ''}`
      ).catch(() => {})
    }
  } else if (action === 'hk_approve') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await approveByHK(id, uid, notes || '')
    if (request) {
      logActivity(user.email, user.name, 'leave_hk_approved',
        `Harshil fully approved ${request.employee_name}'s ${request.leave_type} leave (${request.date_from} – ${request.date_to}, ${request.days_requested} days)`).catch(() => {})
      notifyEmployee(
        user, request.employee_name,
        `🎉 Your leave request has been fully approved!\n\n📅 ${request.date_from} – ${request.date_to} (${request.days_requested} day${request.days_requested !== 1 ? 's' : ''})\nType: ${request.leave_type}${notes ? `\n\nHarshil's note: ${notes}` : ''}`
      ).catch(() => {})
    }
  } else if (action === 'reject') {
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    await rejectLeave(id, notes || 'Rejected')
    if (request) {
      logActivity(user.email, user.name, 'leave_rejected',
        `Rejected ${request.employee_name}'s ${request.leave_type} leave (${request.date_from} – ${request.date_to})${notes ? ` — ${notes}` : ''}`).catch(() => {})
      notifyEmployee(
        user, request.employee_name,
        `❌ Your leave request (${request.date_from} – ${request.date_to}) has been rejected.${notes ? `\n\nReason: ${notes}` : ''}`
      ).catch(() => {})
    }
  } else {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}

async function notifyEmployee(
  sender: { id: string | number; name: string },
  employeeName: string,
  message: string
) {
  const employee = await getUserByName(employeeName)
  if (!employee || String(employee.id) === String(sender.id)) return
  await postDMMessage(String(sender.id), sender.name, String(employee.id), employee.name, message)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const id = parseInt(params.id, 10)
  const ok = await deleteLeaveRequest(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
