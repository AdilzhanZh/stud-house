export type TransferRequestStatus = 'pending' | 'approved' | 'rejected'

export interface TransferRequest {
  id: string
  student_id: string
  current_room_id: string
  requested_dormitory_id: string | null
  requested_room_id: string | null
  reason: string | null
  status: TransferRequestStatus
  decided_by: string | null
  decided_at: string | null
  comment: string | null
  created_at: string
}
