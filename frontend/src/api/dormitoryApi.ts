import { apiClient } from './client'
import type { Dormitory, DormitoryImage } from '../types/dormitories'

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
