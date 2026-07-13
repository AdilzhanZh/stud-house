export type Role = 'admin' | 'student' | 'manager'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface User {
  id: string
  full_name: string
  email: string
  phone: string
  iin: string | null
  role: Role
  // Committee membership is an admin-elected flag on a manager, not a
  // separate role. is_chairperson is a further flag on top of that.
  is_committee_member: boolean
  is_chairperson: boolean
  approval_status: ApprovalStatus
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type Gender = 'male' | 'female'

export type AcademicDegree = 'bachelor' | 'master'

export interface StudentProfile {
  user_id: string
  gender: Gender | null
  course: number | null
  academic_degree: AcademicDegree | null
}

export interface TokenPair {
  access_token: string
  refresh_token: string
}

export interface LoginResponse extends TokenPair {
  user: User
}

export interface ApiErrorBody {
  error: {
    code: string
    message: string
  }
}
