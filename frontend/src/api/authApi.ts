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
}

export interface LoginPayload {
  email: string
  password: string
}

export async function register(payload: RegisterPayload): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/auth/register', payload)
  return data.data
}

export async function verifyEmail(email: string, code: string): Promise<void> {
  await apiClient.post('/auth/verify-email', { email, code })
}

export async function resendVerification(email: string): Promise<void> {
  await apiClient.post('/auth/resend-verification', { email })
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
