export const LEAVE_COMPANIES = [
  'Berlin Equipment Ltd',
  'Doctor Pharma (K) Limited',
  'Getwell Hospital Ltd (GHL)',
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
export type LeaveStatus = 'pending_hr' | 'pending_hk' | 'approved' | 'rejected'

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual:        'Annual Leave',
  sick:          'Sick Leave',
  maternity:     'Maternity Leave',
  paternity:     'Paternity Leave',
  compassionate: 'Compassionate Leave',
  absence:       'Leave of Absence',
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending_hr:  'Pending HR Review',
  pending_hk:  'Pending HK Approval',
  approved:    'Approved',
  rejected:    'Rejected',
}

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
  hr_notes: string
  hr_reviewed_by: number | null
  hr_reviewed_at: string | null
  hk_notes: string
  hk_approved_by: number | null
  hk_approved_at: string | null
  rejection_reason: string
  submitted_at: string
  year: number
}
