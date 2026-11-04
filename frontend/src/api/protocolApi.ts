import { apiClient } from './client'
import type { Protocol, ProtocolCandidate, ProtocolDetail, ProtocolStatus, VoteDecision } from '../types/protocols'

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

// Available to the owning student or admin/manager — used by the
// application journey stepper to tell "approved, not yet sent to
// committee" apart from "in committee review" and "committee approved".
// Rejects with 404 if the application isn't attached to any protocol yet.
export async function getApplicationProtocol(applicationId: string): Promise<Protocol> {
  const { data } = await apiClient.get<{ data: Protocol }>(`/applications/${applicationId}/protocol`)
  return data.data
}

// "Хаттама дайындау" (prepare protocol) — bundles the selected approved
// applicants and current residents (none already in another protocol) and
// sends the protocol to every current committee member for review.
export async function createProtocol(applicationIds: string[], residentStudentIds: string[]): Promise<Protocol> {
  const { data } = await apiClient.post<{ data: Protocol }>('/protocols', {
    application_ids: applicationIds,
    resident_student_ids: residentStudentIds,
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

// Approved applicants and current residents not yet in any protocol — the
// "prepare protocol" candidate list.
export async function listProtocolCandidates(): Promise<ProtocolCandidate[]> {
  const { data } = await apiClient.get<{ data: ProtocolCandidate[] }>('/protocols/candidates')
  return data.data
}
