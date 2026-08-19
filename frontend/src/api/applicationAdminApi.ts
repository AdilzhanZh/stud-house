import { apiClient } from './client'
import type { Application, ApplicationStatus } from '../types/applications'

export async function listApplications(status: ApplicationStatus): Promise<Application[]> {
  const { data } = await apiClient.get<{ data: Application[] }>('/applications', {
    params: { status },
  })
  return data.data
}

export type DecisionAction = 'approve' | 'reject' | 'request_correction'

export interface DecideApplicationPayload {
  action: DecisionAction
  room_id?: string
  comment?: string
}

export async function decideApplication(
  id: string,
  payload: DecideApplicationPayload,
): Promise<Application> {
  const { data } = await apiClient.patch<{ data: Application }>(
    `/applications/${id}/decision`,
    payload,
  )
  return data.data
}

// cancelApprovedApplication is for an application stuck in 'approved' with
// no way forward (e.g. no committee members configured to form a protocol).
// decideApplication only accepts 'pending' applications on the backend.
export async function cancelApprovedApplication(
  id: string,
  comment: string,
): Promise<Application> {
  const { data } = await apiClient.patch<{ data: Application }>(
    `/applications/${id}/cancel-approved`,
    { comment },
  )
  return data.data
}
