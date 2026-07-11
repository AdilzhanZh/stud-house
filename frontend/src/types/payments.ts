export type PaymentStatus =
  | 'pending'
  | 'submitted'
  | 'awaiting_manager_decision'
  | 'confirmed'
  | 'rejected'

export interface Payment {
  id: string
  contract_id: string
  amount: number
  currency: string
  receipt_file_url: string | null
  status: PaymentStatus
  submitted_at: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  deadline: string
  reminder_sent_at: string | null
  created_at: string
}
