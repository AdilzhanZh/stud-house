import { apiClient } from './client'
import type { Dormitory, DormitoryCapacity, DormitoryImage } from '../types/dormitories'

export async function listDormitories(): Promise<Dormitory[]> {
  const { data } = await apiClient.get<{ data: Dormitory[] }>('/dormitories')
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
  total_capacity: number
  payment_qr_code_url: string | null
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
