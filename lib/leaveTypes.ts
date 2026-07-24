export const LEAVE_COMPANIES = [
  'Berlin Equipment Ltd',
  'Doctor Pharma (K) Limited',
  'Getwell Health Pharma Ltd',
  'KISCOL',
  'Mali Credit Limited',
  'Mayfair Aviation Ltd',
  'Maxi Tower Ltd',
  'Pabari Investments Limited',
  'Safety Auto Spares (E.A) Limited',
  'Topnotch Investment Holding Limited',
  'Uni Supplies & Marketing (K) Ltd',
  'Unifresh Exotics (K) Limited',
]

export type LeaveType = 'annual' | 'sick' | 'maternity' | 'paternity' | 'compassionate' | 'absence'

export type LeaveStatus =
  | 'pending_supervisor'
  | 'pending_hod'
  | 'pending_hr'
  | 'pending_director'
  | 'pending_hk'   // legacy alias — treated as pending_director
  | 'approved'
  | 'rejected'

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual:        'Annual Leave',
  sick:          'Sick Leave',
  maternity:     'Maternity Leave',
  paternity:     'Paternity Leave',
  compassionate: 'Compassionate Leave',
  absence:       'Leave of Absence',
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending_supervisor: 'Pending Supervisor',
  pending_hod:        'Pending HOD',
  pending_hr:         'Pending HR',
  pending_director:   'Pending Director',
  pending_hk:         'Pending Director',
  approved:           'Approved',
  rejected:           'Rejected',
}

// Ordered approval chain steps for display
export const APPROVAL_CHAIN: { status: LeaveStatus; label: string }[] = [
  { status: 'pending_supervisor', label: 'Supervisor' },
  { status: 'pending_hod',        label: 'HOD' },
  { status: 'pending_hr',         label: 'HR' },
  { status: 'pending_director',   label: 'Director' },
]

export const ANNUAL_LEAVE_LIMIT = 21

export interface LeaveRequest {
  id: number
  employee_id: number | null
  employee_name: string
  employee_no: string
  department: string
  job_title: string
  date_of_employment: string
  telephone: string
  company: string
  leave_type: LeaveType
  date_from: string
  date_to: string
  days_requested: number
  reason: string
  cover_person: string
  status: LeaveStatus
  // Supervisor step
  supervisor_email: string
  supervisor_notes: string
  supervisor_approved_by: string
  supervisor_approved_at: string | null
  // HOD step
  hod_email: string
  hod_notes: string
  hod_approved_by: string
  hod_approved_at: string | null
  // HR step
  hr_notes: string
  hr_reviewed_by: number | null
  hr_reviewed_at: string | null
  // Director step (hk = legacy field names)
  hk_notes: string
  hk_approved_by: number | null
  hk_approved_at: string | null
  // Rejection
  rejection_reason: string
  rejected_by: string
  rejected_step: string
  submitted_at: string
  year: number
}
