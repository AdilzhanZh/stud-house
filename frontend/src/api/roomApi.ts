import { apiClient } from './client'
import type { Bed, BedHistory, BedServiceStatus, BedStatusHistory, Room, RoomAvailability, RoomResident, RoomRestrictions } from '../types/rooms'

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
  floor_id: string
  category: string
  area_sq_m: number | null
  equipment: string | null
  sanitary_conditions: string | null
  is_accessible: boolean | null
  accessibility_notes: string | null
  photo_urls: string[]
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

export async function deleteRoom(id: string): Promise<void> {
  await apiClient.delete(`/rooms/${id}`)
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

// bedId omitted = the room's first free bed.
export async function addResident(roomId: string, studentId: string, bedId?: string): Promise<RoomResident> {
  const { data } = await apiClient.post<{ data: RoomResident }>(`/rooms/${roomId}/residents`, {
    student_id: studentId,
    bed_id: bedId || undefined,
  })
  return data.data
}

export async function moveOutResident(residentId: string): Promise<void> {
  await apiClient.delete(`/room-residents/${residentId}`)
}

// bedId omitted = the target room's first free bed; required to move to
// another bed of the same room.
export async function transferResident(residentId: string, roomId: string, bedId?: string): Promise<RoomResident> {
  const { data } = await apiClient.post<{ data: RoomResident }>(
    `/room-residents/${residentId}/transfer`,
    { room_id: roomId, bed_id: bedId || undefined },
  )
  return data.data
}

export async function listBeds(roomId: string, includeRetired = false): Promise<Bed[]> {
  const { data } = await apiClient.get<{ data: Bed[] }>(`/rooms/${roomId}/beds`, {
    params: includeRetired ? { include_retired: 'true' } : undefined,
  })
  return data.data
}

export async function addBeds(roomId: string, count = 1): Promise<Bed[]> {
  const { data } = await apiClient.post<{ data: Bed[] }>(`/rooms/${roomId}/beds`, { count })
  return data.data
}

export async function renameBed(bedId: string, label: string): Promise<Bed> {
  const { data } = await apiClient.patch<{ data: Bed }>(`/beds/${bedId}`, { label })
  return data.data
}

// Marks the bed as removed; its id and history are kept.
export async function retireBed(bedId: string): Promise<void> {
  await apiClient.delete(`/beds/${bedId}`)
}

// The act (акт) behind a manual status change. date: YYYY-MM-DD.
export interface BedActInput {
  number: string
  date: string
  fileUrl?: string
}

// Takes a bed out of service (repair / unavailable, reason required) or
// returns it to service, citing an act. until: expected end date, YYYY-MM-DD.
export async function setBedStatus(
  bedId: string,
  status: BedServiceStatus,
  act: BedActInput,
  reason?: string,
  until?: string,
): Promise<Bed> {
  const { data } = await apiClient.patch<{ data: Bed }>(`/beds/${bedId}/status`, {
    status,
    reason: reason || undefined,
    until: until || undefined,
    act_number: act.number,
    act_date: act.date,
    act_file_url: act.fileUrl || undefined,
  })
  return data.data
}

export async function getBedStatusHistory(bedId: string): Promise<BedStatusHistory> {
  const { data } = await apiClient.get<{ data: BedStatusHistory }>(`/beds/${bedId}/status-history`)
  return data.data
}

export async function getBedHistory(bedId: string): Promise<BedHistory> {
  const { data } = await apiClient.get<{ data: BedHistory }>(`/beds/${bedId}/history`)
  return data.data
}
