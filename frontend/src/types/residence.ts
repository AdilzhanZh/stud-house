export interface Residence {
  room_id: string
  dormitory_id: string
  room_number: string
  floor: number | null
  floor_name: string | null
  capacity: number
  // The student's bed place; null only if the stay predates bed tracking.
  bed_id: string | null
  bed_label: string | null
  bed_code: string | null
  moved_in_at: string
}
