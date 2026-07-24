export type PettyCashStatus = 'pending_hos' | 'pending_hod' | 'pending_finance' | 'approved' | 'disbursed' | 'received' | 'rejected'

export const PETTY_CASH_STATUS_LABELS: Record<PettyCashStatus, string> = {
  pending_hos:     'Under Review',
  pending_hod:     'Under Review',
  pending_finance: 'Under Review',
  approved:        'Approved — Awaiting Disbursement',
  disbursed:       'Disbursed — Awaiting Confirmation',
  received:        'Received ✓',
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
  rejection_reason:       string
  submitted_at:           string
  year:                   number
  project_id:             number | null
  disbursed_by:           string
  disbursed_at:           string | null
  disbursement_method:    'cash' | 'mpesa' | 'bank_transfer' | null
  disbursement_reference: string
  received_at:            string | null
  received_confirmed_by:  string
}
