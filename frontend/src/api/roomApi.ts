import { apiClient } from './client'
import type { Room, RoomAvailability, RoomResident, RoomRestrictions } from '../types/rooms'

export async function listRoomsByDormitory(dormitoryId: string): Promise<Room[]> {
  const { data } = await apiClient.get<{ data: Room[] }>(`/dormitories/${dormitoryId}/rooms`)
  return data.data
}

// Same rooms as listRoomsByDormitory, but with each room's resident/hold
// counts included in one request — used by the room picker so it doesn't
// have to fetch residents per room.
export async function listRoomAvailability(dormitoryId: string): Promise<RoomAvailability[]> {
  const { data } = await apiClient.get<{ data: RoomAvailability[] }>(
    `/dormitories/${dormitoryId}/rooms/availability`,
  )
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
    degrees: restrictions.degrees,
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

export async function moveOutResident(residentId: string): Promise<void> {
  await apiClient.delete(`/room-residents/${residentId}`)
}

export async function transferResident(residentId: string, roomId: string): Promise<RoomResident> {
  const { data } = await apiClient.post<{ data: RoomResident }>(
    `/room-residents/${residentId}/transfer`,
    { room_id: roomId },
  )
  return data.data
}
