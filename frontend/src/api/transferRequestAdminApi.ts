import { apiClient } from './client'
import type { TransferRequest, TransferRequestStatus } from '../types/transferRequests'

export async function listTransferRequests(
  status?: TransferRequestStatus,
): Promise<TransferRequest[]> {
  const { data } = await apiClient.get<{ data: TransferRequest[] }>('/transfer-requests', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export interface DecideTransferRequestPayload {
  action: 'approve' | 'reject'
  room_id?: string
  comment?: string
}

export async function decideTransferRequest(
  id: string,
  payload: DecideTransferRequestPayload,
): Promise<TransferRequest> {
  const { data } = await apiClient.patch<{ data: TransferRequest }>(
    `/transfer-requests/${id}/decision`,
    payload,
  )
  return data.data
}
