import { apiClient } from './client'
import type { Protocol, ProtocolDetail, ProtocolStatus, VoteDecision } from '../types/protocols'
import type { Application } from '../types/applications'

export async function listProtocols(status?: ProtocolStatus): Promise<Protocol[]> {
  const { data } = await apiClient.get<{ data: Protocol[] }>('/protocols', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export async function getProtocolDetail(id: string): Promise<ProtocolDetail> {
  const { data } = await apiClient.get<{ data: ProtocolDetail }>(`/protocols/${id}`)
  return data.data
}

// "Хаттама дайындау" (prepare protocol) — bundles the selected applications
// (must all be approved and not already in another protocol) and sends the
// protocol to every current committee member for review.
export async function createProtocol(applicationIds: string[]): Promise<Protocol> {
  const { data } = await apiClient.post<{ data: Protocol }>('/protocols', {
    application_ids: applicationIds,
  })
  return data.data
}

// Only allowed while the protocol is still 'pending'.
export async function deleteProtocol(id: string): Promise<void> {
  await apiClient.delete(`/protocols/${id}`)
}

// Requires is_committee_member=true.
export async function voteProtocol(id: string, decision: VoteDecision, reason?: string): Promise<Protocol> {
  const { data } = await apiClient.patch<{ data: Protocol }>(`/protocols/${id}/vote`, {
    decision,
    reason,
  })
  return data.data
}

// Approved applications not yet attached to any protocol — the "prepare
// protocol" candidate list.
export async function listEligibleApplications(): Promise<Application[]> {
  const { data } = await apiClient.get<{ data: Application[] }>('/protocols/eligible-applications')
  return data.data
}
