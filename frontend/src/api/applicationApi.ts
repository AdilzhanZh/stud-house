import { apiClient } from './client'
import type { Application, ApplicationDetail } from '../types/applications'

export interface CreateApplicationPayload {
  dormitory_id: string
  notes: string | null
  preferred_room_id?: string | null
  study_group: string
  hometown: string
  parent_contact: string
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

// Deletes the caller's own application. Only works while it's still
// pending (used to roll back a just-created application whose
// document/benefit attachment failed partway through) or once it has been
// rejected (lets the student clear it out of their list).
export async function deleteApplication(id: string): Promise<void> {
  await apiClient.delete(`/applications/${id}`)
}

export interface ResubmitApplicationPayload {
  notes: string | null
  // Only meaningful while the application is needs_correction (its room
  // hold was released on entering that status — see the backend's
  // ApplicationService.Decide) — omit to leave whatever room pick already
  // exists (usually none, right after a correction request) untouched.
  preferred_room_id?: string | null
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
