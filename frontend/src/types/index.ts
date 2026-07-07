export type Role = 'admin' | 'student' | 'manager' | 'committee_member'

export interface User {
  id: string
  full_name: string
  email: string
  phone: string
  role: Role
  is_chairperson: boolean
  created_at: string
  updated_at: string
}

export type Gender = 'male' | 'female'

export interface StudentProfile {
  user_id: string
  gender: Gender | null
  course: number | null
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
