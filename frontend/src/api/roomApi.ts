import { apiClient } from './client'
import type { Room, RoomResident, RoomRestrictions } from '../types/rooms'

export async function listRoomsByDormitory(dormitoryId: string): Promise<Room[]> {
  const { data } = await apiClient.get<{ data: Room[] }>(`/dormitories/${dormitoryId}/rooms`)
  return data.data
}

export async function getRoom(id: string): Promise<Room> {
  const { data } = await apiClient.get<{ data: Room }>(`/rooms/${id}`)
  return data.data
}

export interface RoomPayload {
  room_number: string
  capacity: number
  floor: number | null
  category: string
  area_sq_m: number | null
  equipment: string | null
  top_beds: number
  bottom_beds: number
}

export async function createRoom(dormitoryId: string, payload: RoomPayload): Promise<Room> {
  const { data } = await apiClient.post<{ data: Room }>(
    `/dormitories/${dormitoryId}/rooms`,
    payload,
  )
  return data.data
}

export async function updateRoom(id: string, payload: RoomPayload): Promise<Room> {
  const { data } = await apiClient.patch<{ data: Room }>(`/rooms/${id}`, payload)
  return data.data
}

export async function updateRoomRestrictions(
  id: string,
  restrictions: RoomRestrictions,
): Promise<Room> {
  const { data } = await apiClient.patch<{ data: Room }>(`/rooms/${id}/restrictions`, {
    gender: restrictions.gender,
    courses: restrictions.courses,
    benefit_ids: restrictions.benefit_ids,
  })
  return data.data
}

export async function listRoomResidents(roomId: string): Promise<RoomResident[]> {
  const { data } = await apiClient.get<{ data: RoomResident[] }>(`/rooms/${roomId}/residents`)
  return data.data
}

export async function addResident(roomId: string, studentId: string): Promise<RoomResident> {
  const { data } = await apiClient.post<{ data: RoomResident }>(`/rooms/${roomId}/residents`, {
    student_id: studentId,
  })
  return data.data
}
