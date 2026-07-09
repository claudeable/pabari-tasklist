export type UserRole = 'admin' | 'director' | 'ceo' | 'manager' | 'staff'

export interface SessionUser {
  id:         string
  name:       string
  email:      string
  role:       UserRole
  department: string
  reports_to: string
  hod_email:  string
  companies:  string[]   // ['ALL'] or ['KISCOL'] etc.
}

export interface PublicUser {
  id:         string
  name:       string
  email:      string
  role:       UserRole
  department: string
  reports_to: string
  hod_email:  string
  companies:  string[]
}

export type TaskStatus =
  | 'pending-discussion'
  | 'action-required'
  | 'in-review'
  | 'awaiting-hod-approval'
  | 'awaiting-hk-approval'
  | 'resolved'
  | 'expired'

export type TaskPriority = 'low' | 'medium' | 'high'
export type ApprovalType = 'ceo_approval' | 'no_approval' | ''

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low:    'Low',
  medium: 'Medium',
  high:   'High',
}

export const PRIORITY_STYLE: Record<TaskPriority, { bg: string; color: string }> = {
  high:   { bg: '#fef2f2', color: '#dc2626' },
  medium: { bg: '#fffbeb', color: '#d97706' },
  low:    { bg: '#f0fdf4', color: '#15803d' },
}

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'pending-discussion':   'Pending Discussion',
  'action-required':      'Action Required',
  'in-review':            'In Review',
  'awaiting-hod-approval':'Awaiting HOD Approval',
  'awaiting-hk-approval': 'Awaiting HK Approval',
  'resolved':             'Resolved',
  'expired':              'Expired',
}

export const STATUS_OPTIONS_BY_ROLE: Record<UserRole, TaskStatus[]> = {
  staff:    ['pending-discussion','action-required','in-review','awaiting-hod-approval'],
  ceo:      ['pending-discussion','action-required','in-review','awaiting-hk-approval','resolved','expired'],
  manager:  ['pending-discussion','action-required','in-review','awaiting-hod-approval','awaiting-hk-approval','resolved'],
  director: ['pending-discussion','action-required','in-review','awaiting-hod-approval','awaiting-hk-approval','resolved','expired'],
  admin:    ['pending-discussion','action-required','in-review','awaiting-hod-approval','awaiting-hk-approval','resolved','expired'],
}

export const DEPARTMENTS = [
  'Group Operations',
  'International Operations',
  'Finance',
  'Legal & Corporate',
  'KISCOL',
  'Logistics',
  'GHPL / Hospitality',
  'Project Management',
  'Administration',
  'Director',
  'System',
] as const

export const COMPANIES = [
  'BYTEWISE', 'WELWYN', 'DR.PHARMA', 'PIL',
  'MERCURY', 'MALI CREDIT', 'MALEE', 'GHPL', 'UNIFRESH',
  'PDL', 'USM', 'MAXITOWER', 'EURO TOWERS', 'EPPL',
  'BERLIN_BNK', 'IIGENTRA', 'KISCOL',
] as const

export const SECTIONS = [
  'External Stakeholders - Non-Payment',
  'External Stakeholders - Payment',
  'Outgrowers',
  'Staff - Salary',
  'Staff - Non-Salary',
  'Internal Non-Payment',
  'Put on Hold',
  'General',
] as const

// Sections visible to KISCOL-only users
export const KISCOL_SECTIONS = [
  'External Stakeholders - Non-Payment',
  'External Stakeholders - Payment',
  'Outgrowers',
  'Staff - Salary',
  'Put on Hold',
] as const

export const CATEGORIES = [
  'Other', 'Supplier', 'Staff', 'OG/Outgrower', 'Legal',
  'Finance', 'Operations', 'Auctioneer', 'Travel', 'Bank', 'KRA', 'Auditor',
  'Correspondence',
] as const

export const PEOPLE = [
  'Ahmad', 'Andu', 'Ashok', 'Benson', 'Binal', 'Duncan',
  'Duran', 'Eng. Suresh', 'Harshil', 'Juma', 'Krishina',
  'Lazarus', 'Lulie Aynalem Ewnetu', 'Mungai', 'Paul', 'Pedro',
  'Sabina', 'Simon', 'Yalelet', 'Yared',
] as const

export interface TaskUpdate {
  id:         string
  task_id:    string
  date:       string
  text:       string
  created_at: string
}

export type Recurrence = 'none' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly'

export const RECURRENCE_OPTIONS: { value: Recurrence; label: string; days: number }[] = [
  { value: 'none',        label: 'No Recurrence', days: 0  },
  { value: 'weekly',      label: 'Weekly',         days: 7  },
  { value: 'fortnightly', label: 'Fortnightly',    days: 14 },
  { value: 'monthly',     label: 'Monthly',        days: 30 },
  { value: 'quarterly',   label: 'Quarterly',      days: 90 },
]

export interface Task {
  id:              string
  sno:             number
  date:            string
  company:         string
  section:         string
  category:        string
  particulars:     string
  updates:         string
  responsible:     string
  payment:         'Payment' | 'Non-Payment'
  status:          TaskStatus
  priority:        TaskPriority
  approval_type:   ApprovalType
  approval_status: string   // 'pending' | 'approved' | ''
  approved_by:     string
  approved_at:     string
  status_wk:       string
  hk_comment:      string
  hod_comment:     string
  due_date:        string   // YYYY-MM-DD, '' if not set
  recurrence:      Recurrence
  parent_id?:      string   // links follow-ups and recurrence cycles to their origin task
  legal_review:    boolean  // HOD flagged this task as needing legal review
  legal_comment:   string   // Legal counsel's response/notes
  created_at:      string
  updated_at:      string
  task_updates?:   TaskUpdate[]
}
