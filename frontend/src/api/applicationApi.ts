import { apiClient } from './client'
import type { Application, ApplicationDetail } from '../types/applications'

export interface CreateApplicationPayload {
  dormitory_id: string
  notes: string | null
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

export interface ResubmitApplicationPayload {
  notes: string | null
}

export async function resubmitApplication(
  id: string,
  payload: ResubmitApplicationPayload,
): Promise<Application> {
  const { data } = await apiClient.patch<{ data: Application }>(`/applications/${id}`, payload)
  return data.data
}

export interface AddApplicationDocumentPayload {
  document_name: string
  file_url: string
}

export async function addApplicationDocument(
  id: string,
  payload: AddApplicationDocumentPayload,
) {
  const { data } = await apiClient.post(`/applications/${id}/documents`, payload)
  return data.data
}
