// A certificate of residence. Every field is what was true on issued_at;
// only still_resides is live. iin is only sent to the student themselves.
export interface ResidenceCertificate {
  number: number
  token: string
  student_full_name: string
  iin?: string
  institute: string
  study_group: string
  course: number | null
  dormitory_name: string
  dormitory_address: string
  room_number: string
  moved_in_at: string
  signatory_name: string
  issued_at: string
  still_resides: boolean
}

export type CertificateLanguage = 'kk' | 'ru'
