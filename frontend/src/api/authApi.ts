import { apiClient } from './client'
import type { AcademicDegree, Gender, LoginResponse, TokenPair, User } from '../types'

export interface RegisterPayload {
  full_name: string
  email: string
  phone: string
  iin: string
  password: string
  gender: Gender
  course: number
  academic_degree: AcademicDegree
  // Set when the applicant chose "continue anyway" after being warned their
  // email looked unreachable (see the "email_unverifiable" error code).
  skip_email_check?: boolean
}

export interface LoginPayload {
  // Either a 12-digit IIN (students) or an email (admin/manager).
  login: string
  password: string
}

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/auth/register', payload)
  return data.data
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<{ data: LoginResponse }>('/auth/login', payload)
  return data.data
}

export async function refresh(refreshToken: string): Promise<TokenPair> {
  const { data } = await apiClient.post<{ data: TokenPair }>('/auth/refresh', {
    refresh_token: refreshToken,
  })
  return data.data
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refresh_token: refreshToken })
}
