// manager_review is a transient status recorded in history but never the
// resting status of an application (see backend internal/domain/application.go)
// — the spec explicitly notes only pending/needs_correction/approved/rejected
// are ever seen at rest. Included here only so the type covers whatever the
// API could technically send, not because the UI treats it as a real state.
// settled is set by the system once the student accepts their contract (see
// backend internal/domain/contract.go's ApplicationSettled).
export type ApplicationStatus =
  | 'pending'
  | 'manager_review'
  | 'needs_correction'
  | 'approved'
  | 'rejected'
  | 'settled'

export interface Application {
  id: string
  student_id: string
  dormitory_id: string
  status: ApplicationStatus
  preferred_room_type: string | null
  preferred_room_id: string | null
  notes: string | null
  study_group: string
  hometown: string
  parent_contact: string
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
  dormitory_required_document_id: string | null
  document_name: string | null
  display_name_kk: string
  display_name_ru: string
  file_url: string
  uploaded_at: string
  // Only returned to managers, and only for documents that were AI-checked.
  ai_check?: DocumentAICheck
}

export type DocumentCheckStatus = 'pending' | 'processing' | 'done' | 'failed' | 'unsupported'

// What the model extracted from one document (backend domain.DocumentCheckResult).
export interface DocumentCheckResult {
  readable: boolean
  detected_type: string
  matches_expected_type: boolean
  holder_full_name: string
  names_student: 'yes' | 'no' | 'not_applicable' | 'unclear'
  issue_date: string
  forgery_signs: boolean
  forgery_reason_kk: string
  forgery_reason_ru: string
  summary_kk: string
  summary_ru: string
}

export interface DocumentAICheck {
  status: DocumentCheckStatus
  result: DocumentCheckResult | null
  error: string | null
}

// A required document (of the application's dormitory or one of the
// student's benefits) the student has to upload (again). Exactly one of the
// two ids is set — pass it back to addApplicationDocument to fill the slot.
export interface MissingDocument {
  benefit_required_document_id: string | null
  dormitory_required_document_id: string | null
  name_kk: string
  name_ru: string
  reason: 'missing_document' | 'document_unreadable' | 'wrong_document_type' | 'document_expired' | 'unsupported_format'
  detail?: string
}

export interface ApplicationDetail extends Application {
  documents: ApplicationDocument[]
  missing_documents: MissingDocument[]
  history: ApplicationStatusHistoryEntry[]
}

// Green/yellow/red sorting of a pending application by how much manager
// attention it needs (see backend service.TriageService).
export type TriageColor = 'green' | 'yellow' | 'red'

export type TriageReasonCode =
  | 'missing_document'
  | 'room_unavailable'
  | 'document_unreadable'
  | 'wrong_document_type'
  | 'document_expired'
  | 'unsupported_format'
  | 'name_mismatch'
  | 'suspected_forgery'
  | 'check_failed'

export interface TriageReason {
  code: TriageReasonCode
  document_name_kk?: string
  document_name_ru?: string
  detail?: string
}

export interface ApplicationTriage {
  application_id: string
  color: TriageColor
  reasons: TriageReason[]
  // An AI document check is still running; the color may still change.
  checking: boolean
}

export interface BulkResult {
  application_id: string
  ok: boolean
  error?: string
}
