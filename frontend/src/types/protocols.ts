// A protocol only ever rests at two states — see backend
// internal/domain/protocol.go. The per-member vote breakdown (approved /
// rejected / not yet decided) lives on ProtocolDetail.votes, not here.
export type ProtocolStatus = 'pending' | 'approved'

export interface Protocol {
  id: string
  number: number
  status: ProtocolStatus
  created_by: string
  created_at: string
  updated_at: string
}

// Maximum students in one protocol — mirrors backend domain.MaxProtocolStudents.
export const MAX_PROTOCOL_STUDENTS = 500

// application_id is null for a current resident, who has no application to
// attach and is sent to createProtocol by student id instead.
export interface ProtocolCandidate {
  application_id: string | null
  student_id: string
  student_full_name: string
  dormitory_id: string
  dormitory_name: string
  room_number: string | null
}

// The application and dormitory id fields are null for a current resident.
export interface ProtocolStudent {
  application_id: string | null
  application_status: string | null
  student_id: string
  student_full_name: string
  student_email: string
  student_phone: string
  dormitory_id: string | null
  dormitory_name: string
  assigned_room_id: string | null
  room_number: string | null
}

export type VoteDecision = 'approved' | 'rejected'

export interface CommitteeVote {
  committee_member_id: string
  committee_member_name: string
  decision: VoteDecision | null
  reason: string | null
  voted_at: string | null
}

export interface ProtocolDetail extends Protocol {
  students: ProtocolStudent[]
  votes: CommitteeVote[]
}
