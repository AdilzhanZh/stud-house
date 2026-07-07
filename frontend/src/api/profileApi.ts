import { apiClient } from './client'
import type { Gender, StudentProfile } from '../types'

export interface UpdateProfilePayload {
  gender: Gender | null
  course: number | null
}

export async function getStudentProfile(userId: string): Promise<StudentProfile> {
  const { data } = await apiClient.get<{ data: StudentProfile }>(`/students/${userId}/profile`)
  return data.data
}

export async function updateStudentProfile(
  userId: string,
  payload: UpdateProfilePayload,
): Promise<StudentProfile> {
  const { data } = await apiClient.put<{ data: StudentProfile }>(
    `/students/${userId}/profile`,
    payload,
  )
  return data.data
}
