import { apiClient } from './client'

export type BroadcastAudience = 'all' | 'dormitory' | 'student'

export interface BroadcastPayload {
  audience: BroadcastAudience
  dormitory_id?: string
  student_id?: string
  title: string
  body: string
}

export async function sendBroadcast(payload: BroadcastPayload): Promise<{ sent: number }> {
  const { data } = await apiClient.post<{ data: { sent: number } }>('/notifications/broadcast', payload)
  return data.data
}
