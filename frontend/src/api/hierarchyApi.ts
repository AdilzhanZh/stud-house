import { apiClient } from './client'
import type { DormObject, Floor, RegistryObject } from '../types/hierarchy'

export async function listObjects(): Promise<DormObject[]> {
  const { data } = await apiClient.get<{ data: DormObject[] }>('/dorm-objects')
  return data.data
}

export interface ObjectPayload {
  name: string
  owner_name: string | null
  bin: string | null
  ownership_form: string | null
  phone: string | null
}

export async function createObject(payload: ObjectPayload): Promise<DormObject> {
  const { data } = await apiClient.post<{ data: DormObject }>('/dorm-objects', payload)
  return data.data
}

export async function updateObject(id: string, payload: ObjectPayload): Promise<DormObject> {
  const { data } = await apiClient.patch<{ data: DormObject }>(`/dorm-objects/${id}`, payload)
  return data.data
}

// Only an object with no buildings can be deleted.
export async function deleteObject(id: string): Promise<void> {
  await apiClient.delete(`/dorm-objects/${id}`)
}

// Puts the buildings into the object (merging their old objects into it);
// objects left with no buildings are removed.
export async function moveDormitoriesToObject(objectId: string, dormitoryIds: string[]): Promise<DormObject> {
  const { data } = await apiClient.post<{ data: DormObject }>(`/dorm-objects/${objectId}/dormitories`, {
    dormitory_ids: dormitoryIds,
  })
  return data.data
}

export async function listDormitoryFloors(dormitoryId: string): Promise<Floor[]> {
  const { data } = await apiClient.get<{ data: Floor[] }>(`/dormitories/${dormitoryId}/floors`)
  return data.data
}

export interface FloorPayload {
  number: number
  name: string | null
}

export async function createFloor(dormitoryId: string, payload: FloorPayload): Promise<Floor> {
  const { data } = await apiClient.post<{ data: Floor }>(`/dormitories/${dormitoryId}/floors`, payload)
  return data.data
}

export async function updateFloor(id: string, payload: FloorPayload): Promise<Floor> {
  const { data } = await apiClient.patch<{ data: Floor }>(`/floors/${id}`, payload)
  return data.data
}

// Marks an empty floor as removed; its id is kept.
export async function retireFloor(id: string): Promise<void> {
  await apiClient.delete(`/floors/${id}`)
}

export async function getRegistry(): Promise<RegistryObject[]> {
  const { data } = await apiClient.get<{ data: RegistryObject[] }>('/registry')
  return data.data
}
