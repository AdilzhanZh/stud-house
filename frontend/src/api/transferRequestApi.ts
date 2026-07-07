import { apiClient } from './client'
import type { TransferRequest } from '../types/transferRequests'

export interface CreateTransferRequestPayload {
  requested_dormitory_id: string | null
  requested_room_id: string | null
  reason: string | null
}

export async function createTransferRequest(
  payload: CreateTransferRequestPayload,
): Promise<TransferRequest> {
  const { data } = await apiClient.post<{ data: TransferRequest }>('/transfer-requests', payload)
  return data.data
}

export async function listMyTransferRequests(): Promise<TransferRequest[]> {
  const { data } = await apiClient.get<{ data: TransferRequest[] }>('/transfer-requests/my')
  return data.data
}
