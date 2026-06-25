export type UserRole = 'admin' | 'director' | 'manager' | 'staff'

export interface SessionUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export interface PublicUser {
  id: string
  name: string
  email: string
  role: UserRole
}

export type TaskStatus =
  | 'pending-discussion'
  | 'action-required'
  | 'in-review'
  | 'resolved'
  | 'expired'

export const STATUS_LABELS: Record<TaskStatus, string> = {
  'pending-discussion': 'Pending Discussion',
  'action-required':    'Action Required',
  'in-review':          'In Review',
  'resolved':           'Resolved',
  'expired':            'Expired',
}

export const COMPANIES = [
  'KISCOL', 'BYTEWISE', 'WELWYN', 'DR.PHARMA', 'PIL',
  'MERCURY', 'MALI CREDIT', 'MALEE', 'GHPL', 'UNIFRESH',
  'PDL', 'USM', 'MAXITOWER', 'EURO TOWERS', 'EPPL',
  'BERLIN_BNK', 'IIGENTRA',
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

export const CATEGORIES = [
  'Other', 'Supplier', 'Staff', 'OG/Outgrower', 'Legal',
  'Finance', 'Operations', 'Auctioneer', 'Travel', 'Bank', 'KRA', 'Auditor',
] as const

export const PEOPLE = [
  'Harshil', 'Sabina', 'Ahmad', 'Ashok', 'Paul', 'Krishnan',
  'Yalelet', 'Eng. Suresh', 'Benson', 'Andu', 'Yared', 'Simon',
  'Rajveer', 'Paul & Yared', 'Paul & Sabina', 'Krishnan & Yalelet',
  'Andu & Krishnan', 'Paul & Benson',
] as const

export interface TaskUpdate {
  id: string
  task_id: string
  date: string
  text: string
  created_at: string
}

export interface Task {
  id: string
  sno: number
  date: string
  company: string
  section: string
  category: string
  particulars: string
  updates: string
  responsible: string
  payment: 'Payment' | 'Non-Payment'
  status: TaskStatus
  status_wk: string
  hk_comment: string
  created_at: string
  updated_at: string
  task_updates?: TaskUpdate[]
}
