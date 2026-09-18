import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken } from '@/lib/auth'
import { getProjectMember, getMeetingById, getMeetingActionTasks, createMeetingActionTask, createProjectActivity } from '@/lib/projects'
import { createTask } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function getAuthedUser(projectId: number) {
  const session = cookies().get('pabari-session')
  const user = session?.value ? await verifyToken(session.value) : null
  if (!user) return { user: null, err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (user.role !== 'admin') {
    const member = await getProjectMember(projectId, user.name)
    if (!member) return { user: null, err: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  return { user, err: null }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string; mid: string } }) {
  const projectId  = parseInt(params.id,  10)
  const meetingId  = parseInt(params.mid, 10)

  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!

  // Verify the meeting belongs to this project
  const owns = await getMeetingById(meetingId, projectId)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await getMeetingActionTasks(meetingId)
  return NextResponse.json(items)
}

export async function POST(req: NextRequest, { params }: { params: { id: string; mid: string } }) {
  const projectId = parseInt(params.id,  10)
  const meetingId = parseInt(params.mid, 10)

  const { user, err } = await getAuthedUser(projectId)
  if (!user) return err!
  if (user.role === 'staff') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Verify the meeting belongs to this project (prevents cross-project manipulation)
  const owns = await getMeetingById(meetingId, projectId)
  if (!owns) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  const actionText: string = String(body.action_text || '').trim()
  if (!actionText) return NextResponse.json({ error: 'action_text required' }, { status: 400 })

  // Pre-check for duplicates BEFORE creating a task (avoids orphaned tasks on race or re-submit)
  const existing = await getMeetingActionTasks(meetingId)
  const alreadyLinked = existing.some(at => at.action_text === actionText.slice(0, 500))
  if (alreadyLinked) {
    return NextResponse.json({ error: 'This action point already has a task.' }, { status: 409 })
  }

  const particulars: string = String(body.particulars || actionText).trim()
  const responsible: string = String(body.responsible || '').trim()
  const due_date:    string = String(body.due_date || '').trim()
  const priority:    string = ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium'
  const company:     string = String(body.company || '').trim()

  // Create the task linked to this project
  const task = await createTask({
    sno:             0,
    date:            new Date().toISOString().slice(0, 10),
    company,
    section:         'General',
    category:        'Projects',
    particulars,
    updates:         `From meeting action point: ${actionText.slice(0, 200)}`,
    responsible,
    payment:         'Non-Payment',
    status:          'pending-discussion',
    priority:        priority as 'low' | 'medium' | 'high',
    approval_type:   '',
    approval_status: '',
    approved_by:     '',
    approved_at:     '',
    status_wk:       '',
    hk_comment:      '',
    hod_comment:     '',
    due_date,
    recurrence:      'none',
    legal_review:    false,
    co_assignees:    [],
    hk_escalation_type: 'none',
    hk_escalation_note: '',
    hk_escalation_by:   '',
    project_id:      projectId,
    created_by:      user.name,
  })

  // Record the action-point → task link.
  // ON CONFLICT DO NOTHING + throw is a safety net for any concurrent duplicate request
  // that slipped past the pre-check above.
  let link
  try {
    link = await createMeetingActionTask({
      meeting_id:  meetingId,
      action_text: actionText,
      task_id:     Number(task.id),
      created_by:  user.name,
    })
  } catch {
    return NextResponse.json({ error: 'This action point already has a task.' }, { status: 409 })
  }

  createProjectActivity({
    project_id:  projectId,
    actor:       user.name,
    action_type: 'task.created_from_action',
    entity_type: 'task',
    entity_id:   Number(task.id),
    description: `${user.name} converted action point to task: "${actionText.slice(0, 100)}"`,
    metadata:    { meeting_id: meetingId, task_id: Number(task.id) },
  }).catch(console.error)
  return NextResponse.json({ task, link }, { status: 201 })
}
