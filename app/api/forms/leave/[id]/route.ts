import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import {
  approveBySupervisor, approveByHOD, approveByHR, approveByDirector,
  rejectLeave, deleteLeaveRequest, getAllLeaveRequests,
} from '@/lib/leave'
import { getUserByEmail, getUserByName } from '@/lib/users'
import { postDMMessage } from '@/lib/chat'
import { logActivity } from '@/lib/activityLog'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const cookieStore = cookies()
  const session = cookieStore.get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const safeInt = (v: unknown) => { const n = parseInt(String(v ?? ''), 10); return isNaN(n) ? 0 : n }
  const id  = safeInt(params.id)
  const uid = safeInt(user.id)
  const { action, notes } = await req.json()

  const isAdmin    = user.role === 'admin' || (user.role === 'director' && user.department === 'Director')
  const isHR       = user.department === 'HR' || isAdmin
  const isDirector = isAdmin

  // Fetch the leave request
  const all     = await getAllLeaveRequests()
  const request = all.find(r => r.id === id)
  if (!request) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── Supervisor approve ──────────────────────────────────────────────
  if (action === 'supervisor_approve') {
    const isSupervisor = user.email === request.supervisor_email || isAdmin
    if (!isSupervisor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (request.status !== 'pending_supervisor') return NextResponse.json({ error: 'Not at supervisor step' }, { status: 400 })

    await approveBySupervisor(id, user.name, notes || '')
    logActivity(user.email, user.name, 'leave_supervisor_approved',
      `${user.name} (supervisor) approved ${request.employee_name}'s ${request.leave_type} leave`).catch(() => {})

    // Notify next in chain: HOD if set, else HR
    if (request.hod_email) {
      notifyByEmail(user, request.hod_email,
        `📋 Leave request pending your approval as HOD.\n\n${request.employee_name} — ${request.leave_type} leave\n${request.date_from} to ${request.date_to} (${request.days_requested} days)\n\nSupervisor has approved. Please review.`
      ).catch(() => {})
    } else {
      notifyHR(user,
        `📋 Leave request (no HOD assigned) pending HR review.\n\n${request.employee_name} — ${request.leave_type} leave\n${request.date_from} to ${request.date_to} (${request.days_requested} days)\n\nSupervisor has approved.`
      ).catch(() => {})
    }
    notifyEmployee(user, request.employee_name,
      `✅ Your leave request has been approved by your supervisor${notes ? `\n\nNote: ${notes}` : ''}. It is now pending HOD approval.`
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  }

  // ── HOD approve ─────────────────────────────────────────────────────
  if (action === 'hod_approve') {
    const isHOD = user.email === request.hod_email || isAdmin
    if (!isHOD) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (request.status !== 'pending_hod') return NextResponse.json({ error: 'Not at HOD step' }, { status: 400 })

    await approveByHOD(id, user.name, notes || '')
    logActivity(user.email, user.name, 'leave_hod_approved',
      `${user.name} (HOD) approved ${request.employee_name}'s ${request.leave_type} leave`).catch(() => {})

    notifyHR(user,
      `📋 Leave request pending HR review.\n\n${request.employee_name} — ${request.leave_type} leave\n${request.date_from} to ${request.date_to} (${request.days_requested} days)\n\nSupervisor and HOD have approved.`
    ).catch(() => {})
    notifyEmployee(user, request.employee_name,
      `✅ Your leave request has been approved by your HOD${notes ? `\n\nNote: ${notes}` : ''}. It is now pending HR approval.`
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  }

  // ── HR approve ──────────────────────────────────────────────────────
  if (action === 'hr_approve') {
    if (!isHR) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (request.status !== 'pending_hr') return NextResponse.json({ error: 'Not at HR step' }, { status: 400 })

    await approveByHR(id, uid, notes || '')
    logActivity(user.email, user.name, 'leave_hr_approved',
      `HR approved ${request.employee_name}'s ${request.leave_type} leave`).catch(() => {})

    notifyDirector(user,
      `📋 Leave request pending your final approval.\n\n${request.employee_name} — ${request.leave_type} leave\n${request.date_from} to ${request.date_to} (${request.days_requested} days)\n\nSupervisor, HOD, and HR have approved.`
    ).catch(() => {})
    notifyEmployee(user, request.employee_name,
      `✅ Your leave request has been approved by HR${notes ? `\n\nNote: ${notes}` : ''}. It is now pending final Director approval.`
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  }

  // ── Director (final) approve ────────────────────────────────────────
  if (action === 'hk_approve' || action === 'director_approve') {
    if (!isDirector) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    const validStatuses = ['pending_director', 'pending_hk']
    if (!validStatuses.includes(request.status)) return NextResponse.json({ error: 'Not at director step' }, { status: 400 })

    await approveByDirector(id, uid, notes || '')
    logActivity(user.email, user.name, 'leave_director_approved',
      `${user.name} fully approved ${request.employee_name}'s ${request.leave_type} leave (${request.date_from} – ${request.date_to}, ${request.days_requested} days)`).catch(() => {})

    notifyEmployee(user, request.employee_name,
      `🎉 Your leave request has been fully approved!\n\n📅 ${request.date_from} – ${request.date_to} (${request.days_requested} day${request.days_requested !== 1 ? 's' : ''})\nType: ${request.leave_type}${notes ? `\n\nNote: ${notes}` : ''}`
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  }

  // ── Reject (any step) ────────────────────────────────────────────────
  if (action === 'reject') {
    const canReject =
      user.email === request.supervisor_email ||
      user.email === request.hod_email ||
      isHR ||
      isDirector
    if (!canReject) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const step = request.status.replace('pending_', '')
    await rejectLeave(id, notes || 'Rejected', user.name, step)
    logActivity(user.email, user.name, 'leave_rejected',
      `${user.name} rejected ${request.employee_name}'s ${request.leave_type} leave at ${step} step${notes ? ` — ${notes}` : ''}`).catch(() => {})

    notifyEmployee(user, request.employee_name,
      `❌ Your leave request (${request.date_from} – ${request.date_to}) has been declined at the ${step} stage by ${user.name}.${notes ? `\n\nReason: ${notes}` : ''}`
    ).catch(() => {})

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}

async function notifyEmployee(sender: { id: string | number; name: string }, employeeName: string, message: string) {
  const employee = await getUserByName(employeeName)
  if (!employee || String(employee.id) === String(sender.id)) return
  await postDMMessage(String(sender.id), sender.name, String(employee.id), employee.name, message)
}

async function notifyByEmail(sender: { id: string | number; name: string }, email: string, message: string) {
  const recipient = await getUserByEmail(email)
  if (!recipient || String(recipient.id) === String(sender.id)) return
  await postDMMessage(String(sender.id), sender.name, String(recipient.id), recipient.name, message)
}

async function notifyHR(sender: { id: string | number; name: string }, message: string) {
  // Notify all HR dept users
  const { getUsers } = await import('@/lib/users')
  const users = await getUsers()
  const hrUsers = users.filter(u => u.department === 'HR' && String(u.id) !== String(sender.id))
  await Promise.all(hrUsers.map(u =>
    postDMMessage(String(sender.id), sender.name, String(u.id), u.name, message)
  ))
}

async function notifyDirector(sender: { id: string | number; name: string }, message: string) {
  const { getUsers } = await import('@/lib/users')
  const users = await getUsers()
  const directors = users.filter(u =>
    (u.role === 'admin' || (u.role === 'director' && u.department === 'Director')) &&
    String(u.id) !== String(sender.id)
  )
  await Promise.all(directors.map(u =>
    postDMMessage(String(sender.id), sender.name, String(u.id), u.name, message)
  ))
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
