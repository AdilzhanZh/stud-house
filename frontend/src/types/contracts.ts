export type ContractStatus =
  | 'sent'
  | 'awaiting_manager_decision'
  | 'accepted'
  | 'declined'
  | 'expired'

export interface Contract {
  id: string
  application_id: string
  file_url: string
  status: ContractStatus
  sent_at: string
  responded_at: string | null
  response_deadline: string
  reminder_sent_at: string | null
  created_at: string
}
