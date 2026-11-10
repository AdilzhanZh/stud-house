export type Gender = 'male' | 'female'

export type AcademicDegree = 'bachelor' | 'master' | 'doctorate'

// Mirrors internal/domain/room.go's RoomRestrictions: every field is
// optional/omittable meaning "no restriction on this dimension". Courses and
// degrees are membership lists (student's course/degree must be IN the set),
// not a minimum threshold.
export interface RoomRestrictions {
  gender: Gender | null
  courses: number[]
  degrees: AcademicDegree[]
  benefit_ids: string[]
}

export interface Room {
  id: string
  dormitory_id: string
  // The floor record the room is on; floor (number) mirrors its number.
  floor_id: string
  floor_name: string | null
  room_number: string
  capacity: number
  floor: number | null
  category: string
  restrictions: RoomRestrictions
  // Optional descriptive fields — null / empty means not filled in.
  area_sq_m: number | null
  equipment: string | null
  sanitary_conditions: string | null
  is_accessible: boolean | null
  accessibility_notes: string | null
  photo_urls: string[]
  created_at: string
  updated_at: string
}

// Room plus how many seats are already spoken for — by actual residents
// (resident_count) and by other pending applicants who currently have this
// room as their pick (held_count, a "hold" — see the backend's
// RoomService.CheckHoldable). capacity - resident_count - held_count is how
// many more applicants may still pick this room.
export interface RoomAvailability extends Room {
  resident_count: number
  held_count: number
}

// moved_in_at is always set — RoomRepository.AddResident inserts room_id +
// student_id + moved_in_at (DB default now()) together in one statement,
// so there is no "reserved but not yet moved in" (moved_in_at IS NULL)
// state in this backend, despite that case being mentioned in the spec.
//
// bed_* describe the bed place the stay is on; null only for stays that had
// already ended before beds were tracked.
export interface RoomResident {
  id: string
  room_id: string
  student_id: string
  bed_id: string | null
  bed_label: string | null
  bed_code: string | null
  moved_in_at: string
  moved_out_at: string | null
}

// One bed place in a room. id and code (e.g. "B-000412") are permanent: a
// bed is never renumbered or deleted, only retired when it is physically
// removed. label is the editable position name. resident_id/student_id are
// the current stay, both null when the bed is free.
export interface Bed {
  id: string
  inventory_no: number
  code: string
  room_id: string
  label: string
  created_at: string
  retired_at: string | null
  resident_id: string | null
  student_id: string | null
}

export interface BedHistory {
  bed: Bed
  stays: RoomResident[]
}
