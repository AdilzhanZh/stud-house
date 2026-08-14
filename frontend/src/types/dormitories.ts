export type DormitoryType = 'sectional' | 'corridor' | 'block'

export interface Dormitory {
  id: string
  name: string
  address: string
  phone: string | null
  dorm_type: DormitoryType | null
  floor_count: number | null
  total_rooms_target: number | null
  total_capacity: number
  monthly_payment_bachelor: number | null
  monthly_payment_master: number | null
  monthly_payment_doctorate: number | null
  yearly_payment_bachelor: number | null
  yearly_payment_master: number | null
  yearly_payment_doctorate: number | null
  built_year: string | null
  commissioned_year: string | null
  ownership_form: string | null
  closed_for_applications: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface DormitoryImage {
  id: string
  dormitory_id: string
  image_url: string
  created_at: string
}

export interface DormitoryRequiredDocument {
  id: string
  dormitory_id: string
  document_id: string
  document_name: string
  created_at: string
}

export interface DormitoryCapacity {
  dormitory_id: string
  total_capacity: number
  allocated_beds: number
  total_rooms_target: number | null
  rooms_created: number
}
