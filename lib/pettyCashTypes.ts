export type PettyCashStatus = 'pending_hos' | 'pending_hod' | 'pending_finance' | 'approved' | 'rejected'

export const PETTY_CASH_STATUS_LABELS: Record<PettyCashStatus, string> = {
  pending_hos:     'Pending HOS (Krishna)',
  pending_hod:     'Pending HOD Approval',
  pending_finance: 'Pending Finance (Andu)',
  approved:        'Approved',
  rejected:        'Rejected',
}

export interface PettyCashItem {
  description: string
  account_no:  string
  amount:      number
}

export interface PettyCashRequest {
  id:               number
  form_type:        'kiscol' | 'general'
  payment_method:   'cash' | 'mpesa' | 'bank_transfer'
  req_no:           string
  voucher_no:       string
  request_date:     string
  company:          string
  employee_id:      number | null
  employee_name:    string
  employee_id_no:   string
  department:       string
  items:            PettyCashItem[]
  total_amount:     number
  amount_in_words:  string
  delegate_name:    string
  delegate_id_no:   string
  hod_id:           number | null
  hod_name:         string
  status:           PettyCashStatus
  hos_approved_by:  number | null
  hos_approved_at:  string | null
  hod_approved_by:  number | null
  hod_approved_at:  string | null
  finance_approved_by: number | null
  finance_approved_at: string | null
  rejection_reason: string
  submitted_at:     string
  year:             number
  project_id:       number | null
}
