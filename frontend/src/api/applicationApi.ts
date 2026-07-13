import { apiClient } from './client'
import type { Application, ApplicationDetail } from '../types/applications'

export interface CreateApplicationPayload {
  dormitory_id: string
  notes: string | null
  preferred_room_id?: string | null
  stay_months: number
}

export async function createApplication(payload: CreateApplicationPayload): Promise<Application> {
  const { data } = await apiClient.post<{ data: Application }>('/applications', payload)
  return data.data
}

export async function listMyApplications(): Promise<Application[]> {
  const { data } = await apiClient.get<{ data: Application[] }>('/applications/my')
  return data.data
}

export async function getApplication(id: string): Promise<ApplicationDetail> {
  const { data } = await apiClient.get<{ data: ApplicationDetail }>(`/applications/${id}`)
  return data.data
}

// Rolls back a just-created application whose document/benefit attachment
// failed partway through — only works while it's still pending.
export async function deleteApplication(id: string): Promise<void> {
  await apiClient.delete(`/applications/${id}`)
}

export interface ResubmitApplicationPayload {
  notes: string | null
  stay_months: number
}

export async function resubmitApplication(
  id: string,
  payload: ResubmitApplicationPayload,
): Promise<Application> {
  const { data } = await apiClient.patch<{ data: Application }>(`/applications/${id}`, payload)
  return data.data
}

export interface AddApplicationDocumentPayload {
  benefit_required_document_id?: string
  dormitory_required_document_id?: string
  document_name?: string
  file_url: string
}

export async function addApplicationDocument(
  id: string,
  payload: AddApplicationDocumentPayload,
) {
  const { data } = await apiClient.post(`/applications/${id}/documents`, payload)
  return data.data
}
