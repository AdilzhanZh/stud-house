import { apiClient } from './client'
import type { StudentProfile, User } from '../types'

export async function getStudentProfile(userId: string): Promise<StudentProfile> {
  const { data } = await apiClient.get<{ data: StudentProfile }>(`/students/${userId}/profile`)
  return data.data
}

// What a student's documents are filled from. A field left out keeps its
// saved value.
export interface StudentDetailsUpdate {
  // IIN and course only fill a gap: a recorded value is changed by a manager.
  iin?: string
  course?: number
  phone?: string
  institute?: string
  study_group?: string
  hometown?: string
  parent_contact?: string
}

export async function updateStudentDetails(
  userId: string,
  details: StudentDetailsUpdate,
): Promise<{ user: User; profile: StudentProfile }> {
  const { data } = await apiClient.patch<{ data: { user: User; profile: StudentProfile } }>(
    `/students/${userId}/details`,
    details,
  )
  return data.data
}
