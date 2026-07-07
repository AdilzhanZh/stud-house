export type Gender = 'male' | 'female'

// Mirrors internal/domain/room.go's RoomRestrictions: every field is
// optional/omittable meaning "no restriction on this dimension". Courses is
// a membership list (student's course must be IN this set), not a minimum
// threshold.
export interface RoomRestrictions {
  gender: Gender | null
  courses: number[]
  benefit_ids: string[]
}

export interface Room {
  id: string
  dormitory_id: string
  room_number: string
  capacity: number
  restrictions: RoomRestrictions
  created_at: string
  updated_at: string
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
