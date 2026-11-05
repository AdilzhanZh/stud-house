// Everything about the student is empty when valid is false: see the backend's
// referralDTO.
export interface Referral {
  number: number
  token: string
  valid: boolean
  issued_at: string
  protocol_number: number
  student_full_name: string
  institute: string
  study_group: string
  dormitory_name: string
  dormitory_address: string
  room_number: string
  signatory_name: string
}
