import { apiClient } from './client'
import type { ExitRequest, ExitRequestStatus } from '../types/exitRequests'

export async function listExitRequests(status?: ExitRequestStatus): Promise<ExitRequest[]> {
  const { data } = await apiClient.get<{ data: ExitRequest[] }>('/exit-requests', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export interface DecideExitRequestPayload {
  action: 'approve' | 'reject'
  comment?: string
}

export async function decideExitRequest(
  id: string,
  payload: DecideExitRequestPayload,
): Promise<ExitRequest> {
  const { data } = await apiClient.patch<{ data: ExitRequest }>(
    `/exit-requests/${id}/decision`,
    payload,
  )
  return data.data
}
