// manager_review is a transient status recorded in history but never the
// resting status of an application (see backend internal/domain/application.go)
// — the spec explicitly notes only pending/needs_correction/approved/rejected
// are ever seen at rest. Included here only so the type covers whatever the
// API could technically send, not because the UI treats it as a real state.
export type ApplicationStatus =
  | 'pending'
  | 'manager_review'
  | 'needs_correction'
  | 'approved'
  | 'rejected'

export interface Application {
  id: string
  student_id: string
  dormitory_id: string
  status: ApplicationStatus
  preferred_room_type: string | null
  notes: string | null
  assigned_room_id: string | null
  handled_by: string | null
  created_at: string
  updated_at: string
}

export interface ApplicationStatusHistoryEntry {
  id: string
  application_id: string
  from_status: ApplicationStatus | null
  to_status: ApplicationStatus
  comment: string | null
  changed_by: string
  created_at: string
}

export interface ApplicationDocument {
  id: string
  application_id: string
  benefit_required_document_id: string | null
  document_name: string | null
  file_url: string
  uploaded_at: string
}

export interface ApplicationDetail extends Application {
  documents: ApplicationDocument[]
  history: ApplicationStatusHistoryEntry[]
}
