import { apiClient } from './client'
import type { Residence } from '../types/residence'

export async function getMyResidence(studentId: string): Promise<Residence> {
  const { data } = await apiClient.get<{ data: Residence }>(`/students/${studentId}/residence`)
  return data.data
}
