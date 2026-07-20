export type ReportStudentColumn = 'full_name' | 'email' | 'phone' | 'dormitory_name' | 'room_number'

export interface ReportTemplate {
  id: string
  name: string
  intro_text: string
  student_columns: ReportStudentColumn[]
  file_url: string | null
  created_by: string
  created_at: string
}

export type ReportStatus = 'pending_committee' | 'approved' | 'rejected'

export interface Report {
  id: string
  template_id: string
  created_by: string
  status: ReportStatus
  previous_report_id: string | null
  created_at: string
  updated_at: string
}

export interface ReportStudent {
  application_id: string
  application_status: string
  student_id: string
  student_full_name: string
  student_email: string
  student_phone: string
  dormitory_id: string
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

export interface ReportDetail extends Report {
  template: ReportTemplate
  students: ReportStudent[]
  votes: CommitteeVote[]
}
