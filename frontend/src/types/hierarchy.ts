import type { BedStatus } from './rooms'

// Registry levels around a dormitory building (see backend
// domain.DormObject / domain.Floor): the object above it, floors below it.

// The dormitory as an organisation with one owner (e.g. the university's
// student houses). Its buildings are Dormitory records.
export interface DormObject {
  id: string
  name: string
  owner_name: string | null
  bin: string | null
  ownership_form: string | null
  phone: string | null
  dormitory_count: number
  created_at: string
  updated_at: string
}

// number is null only for the "floor not set" placeholder holding rooms
// created before floors were required. Ids are permanent; a floor is never
// deleted, only retired (retired_at) once empty.
export interface Floor {
  id: string
  dormitory_id: string
  number: number | null
  name: string | null
  created_at: string
  retired_at: string | null
  room_count: number
}

export interface RegistryBed {
  id: string
  code: string
  label: string
  occupied: boolean
  status: BedStatus
  service_reason: string | null
  service_until: string | null
  status_changed_at: string | null
}

export interface RegistryRoom {
  id: string
  room_number: string
  capacity: number
  beds: RegistryBed[]
}

export interface RegistryFloor {
  id: string
  number: number | null
  name: string | null
  rooms: RegistryRoom[]
}

export interface RegistryDormitory {
  id: string
  name: string
  address: string
  floors: RegistryFloor[]
}

export interface RegistryObject {
  id: string
  name: string
  owner_name: string | null
  ownership_form: string | null
  dormitories: RegistryDormitory[]
}
