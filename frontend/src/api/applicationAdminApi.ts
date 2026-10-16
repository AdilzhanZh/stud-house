import { apiClient } from './client'
import type { Application, ApplicationStatus, ApplicationTriage, BulkResult } from '../types/applications'

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

export async function listApplicationTriage(): Promise<ApplicationTriage[]> {
  const { data } = await apiClient.get<{ data: ApplicationTriage[] }>('/application-triage')
  return data.data
}

// Both bulk actions re-check each application on the backend and skip any
// that are no longer the expected color, reporting that per application.
export async function approveGreenApplications(ids: string[]): Promise<BulkResult[]> {
  const { data } = await apiClient.post<{ data: BulkResult[] }>('/application-triage/approve-green', {
    application_ids: ids,
  })
  return data.data
}

export async function requestApplicationCorrections(ids: string[]): Promise<BulkResult[]> {
  const { data } = await apiClient.post<{ data: BulkResult[] }>('/application-triage/request-corrections', {
    application_ids: ids,
  })
  return data.data
}
