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
  'IT',
  'HR',
  'Executive',
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
  'Duran', 'Eng. Suresh', 'Harshil', 'James', 'Juma', 'Krishina',
  'Lazarus', 'Lulie Aynalem Ewnetu', 'Mungai', 'Paul', 'Pedro',
  'Sabina', 'Simon', 'Yalelet', 'Yared',
] as const

// Finance category is only visible to these users
export const FINANCE_VISIBLE_EMAILS = new Set([
  'hkotecha@kwale-group.com',
  'pmureithi@usm.co.ke',
  'yaynalem@usm.co.ke',
  'rkrishnan@usm.co.ke',
  'ateferi@kwale-group.com',
])

export interface TaskAttachment {
  id:            number
  task_id:       string
  update_id:     string | null
  name:          string
  mime_type:     string
  size:          number
  uploaded_by:   string
  uploader_name: string
  created_at:    string
}

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

export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed'
export type RAGStatus    = 'green' | 'amber' | 'red' | 'not-set'

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  planning:  'Planning',
  active:    'Active',
  'on-hold': 'On Hold',
  completed: 'Completed',
}

export const PROJECT_STATUS_STYLE: Record<ProjectStatus, { bg: string; color: string }> = {
  planning:  { bg: '#eff6ff', color: '#1d4ed8' },
  active:    { bg: '#f0fdf4', color: '#15803d' },
  'on-hold': { bg: '#fffbeb', color: '#d97706' },
  completed: { bg: '#f3f4f6', color: '#6b7280' },
}

export interface Milestone {
  id:         number
  project_id: number
  title:      string
  due_date:   string
  status:     'pending' | 'completed'
  created_at: string
}

export interface Project {
  id:          number
  name:        string
  description: string
  company:     string
  owner:       string
  status:      ProjectStatus
  rag_status:  RAGStatus
  start_date:  string
  end_date:    string
  budget:      number
  spent:       number
  created_by:  string
  created_at:  string
  milestones:  Milestone[]
  task_count:  number
  done_count:  number
}

export interface ProjectMember {
  id:         number
  project_id: number
  user_name:  string
  role:       string
  added_at:   string
}

export interface StatusReport {
  id:         number
  project_id: number
  author:     string
  rag:        RAGStatus
  narrative:  string
  blockers:   string
  next_steps: string
  created_at: string
}

export interface ProjectExpense {
  id:           number
  project_id:   number
  description:  string
  amount:       number
  expense_date: string
  category:     string
  logged_by:    string
  created_at:   string
}

// ─── Finance ──────────────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'accepted' | 'paid' | 'overdue' | 'cancelled'
export type DocType       = 'quotation' | 'invoice' | 'lpo'

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft:     'Draft',
  sent:      'Sent',
  accepted:  'Accepted',
  paid:      'Paid',
  overdue:   'Overdue',
  cancelled: 'Cancelled',
}

export const INVOICE_STATUS_STYLE: Record<InvoiceStatus, { bg: string; color: string }> = {
  draft:     { bg: '#f3f4f6', color: '#6b7280' },
  sent:      { bg: '#dbeafe', color: '#1d4ed8' },
  accepted:  { bg: '#ede9fe', color: '#6d28d9' },
  paid:      { bg: '#dcfce7', color: '#15803d' },
  overdue:   { bg: '#fee2e2', color: '#dc2626' },
  cancelled: { bg: '#f9fafb', color: '#9ca3af' },
}

export interface InvoiceItem {
  description: string
  qty:         number
  unit_price:  number
  amount:      number
}

export interface Invoice {
  id:              number
  doc_no:          string
  type:            DocType
  status:          InvoiceStatus
  issuing_company: string
  client_name:     string
  client_address:  string
  client_email:    string
  issue_date:      string
  due_date:        string
  validity_date:   string
  items:           InvoiceItem[]
  subtotal:        number
  tax_rate:        number
  tax_amount:      number
  total:           number
  notes:           string
  terms:           string
  project_id:      number | null
  created_by:      string
  created_at:      string
  converted_from:  number | null
}

export interface DeliveryNote {
  id:            number
  dn_no:         string
  invoice_id:    number | null
  invoice_no:    string
  project_id:    number | null
  delivery_date: string
  delivered_to:  string
  received_by:   string
  items:         InvoiceItem[]
  notes:         string
  created_by:    string
  created_at:    string
}

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
  project_id?:     number   // optional link to a project
  parent_id?:      string   // links follow-ups and recurrence cycles to their origin task
  legal_review:    boolean  // HOD flagged this task as needing legal review
  legal_comment:   string   // Legal counsel's response/notes
  created_at:      string
  updated_at:      string
  task_updates?:   TaskUpdate[]
}
