export interface ReportTemplate {
  id: string
  name: string
  file_url: string
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
  assigned_room_id: string | null
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
