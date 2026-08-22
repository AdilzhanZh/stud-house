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
  room_number: string
  capacity: number
  floor: number | null
  category: string
  restrictions: RoomRestrictions
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
export interface RoomResident {
  id: string
  room_id: string
  student_id: string
  moved_in_at: string
  moved_out_at: string | null
}
