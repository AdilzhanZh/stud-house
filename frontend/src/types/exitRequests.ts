export type ExitRequestStatus = 'pending' | 'approved' | 'rejected'

export interface ExitRequest {
  id: string
  room_resident_id: string
  student_id: string
  reason: string | null
  status: ExitRequestStatus
  requested_at: string
  decided_by: string | null
  decided_at: string | null
  comment: string | null
}
