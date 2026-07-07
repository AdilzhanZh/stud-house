import { apiClient } from './client'
import type { ExitRequest } from '../types/exitRequests'

export async function createExitRequest(reason: string | null): Promise<ExitRequest> {
  const { data } = await apiClient.post<{ data: ExitRequest }>('/exit-requests', { reason })
  return data.data
}

export async function listMyExitRequests(): Promise<ExitRequest[]> {
  const { data } = await apiClient.get<{ data: ExitRequest[] }>('/exit-requests/my')
  return data.data
}
