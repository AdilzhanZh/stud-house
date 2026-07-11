import { apiClient } from './client'
import type { StudentProfile } from '../types'

export async function getStudentProfile(userId: string): Promise<StudentProfile> {
  const { data } = await apiClient.get<{ data: StudentProfile }>(`/students/${userId}/profile`)
  return data.data
}
