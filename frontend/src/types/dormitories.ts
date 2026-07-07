export interface Dormitory {
  id: string
  name: string
  address: string
  total_capacity: number
  payment_qr_code_url: string | null
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

export interface DormitoryCapacity {
  dormitory_id: string
  total_capacity: number
  allocated_beds: number
}
