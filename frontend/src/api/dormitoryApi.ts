import { apiClient } from './client'
import type {
  Dormitory,
  DormitoryCapacity,
  DormitoryImage,
  DormitoryRequiredDocument,
  DormitoryType,
} from '../types/dormitories'

export async function listDormitories(openOnly = false): Promise<Dormitory[]> {
  const { data } = await apiClient.get<{ data: Dormitory[] }>('/dormitories', {
    params: openOnly ? { open_only: 'true' } : undefined,
  })
  return data.data
}

export async function getDormitory(id: string): Promise<Dormitory> {
  const { data } = await apiClient.get<{ data: Dormitory }>(`/dormitories/${id}`)
  return data.data
}

export async function listDormitoryImages(dormitoryId: string): Promise<DormitoryImage[]> {
  const { data } = await apiClient.get<{ data: DormitoryImage[] }>(
    `/dormitories/${dormitoryId}/images`,
  )
  return data.data
}

export async function getDormitoryCapacity(id: string): Promise<DormitoryCapacity> {
  const { data } = await apiClient.get<{ data: DormitoryCapacity }>(`/dormitories/${id}/capacity`)
  return data.data
}

export interface DormitoryPayload {
  name: string
  address: string
  phone: string | null
  dorm_type: DormitoryType | null
  floor_count: number | null
  total_rooms_target: number | null
  total_capacity: number
  rooms_male: number | null
  rooms_female: number | null
  rooms_mixed: number | null
  monthly_payment: number | null
  yearly_payment: number | null
  built_year: string | null
  commissioned_year: string | null
  ownership_form: string | null
  closed_for_applications: boolean
}

export async function createDormitory(payload: DormitoryPayload): Promise<Dormitory> {
  const { data } = await apiClient.post<{ data: Dormitory }>('/dormitories', payload)
  return data.data
}

export async function updateDormitory(id: string, payload: DormitoryPayload): Promise<Dormitory> {
  const { data } = await apiClient.patch<{ data: Dormitory }>(`/dormitories/${id}`, payload)
  return data.data
}

export async function addDormitoryImage(
  dormitoryId: string,
  imageUrl: string,
): Promise<DormitoryImage> {
  const { data } = await apiClient.post<{ data: DormitoryImage }>(
    `/dormitories/${dormitoryId}/images`,
    { image_url: imageUrl },
  )
  return data.data
}

export async function deleteDormitoryImage(dormitoryId: string, imageId: string): Promise<void> {
  await apiClient.delete(`/dormitories/${dormitoryId}/images/${imageId}`)
}

export async function deleteDormitory(id: string): Promise<void> {
  await apiClient.delete(`/dormitories/${id}`)
}

export async function listDormitoryRequiredDocuments(
  dormitoryId: string,
): Promise<DormitoryRequiredDocument[]> {
  const { data } = await apiClient.get<{ data: DormitoryRequiredDocument[] }>(
    `/dormitories/${dormitoryId}/documents`,
  )
  return data.data
}

export async function addDormitoryRequiredDocument(
  dormitoryId: string,
  documentId: string,
): Promise<DormitoryRequiredDocument> {
  const { data } = await apiClient.post<{ data: DormitoryRequiredDocument }>(
    `/dormitories/${dormitoryId}/documents`,
    { document_id: documentId },
  )
  return data.data
}

export async function deleteDormitoryRequiredDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/dormitory-documents/${documentId}`)
}
