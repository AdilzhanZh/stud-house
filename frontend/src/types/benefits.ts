export interface Benefit {
  id: string
  name: string
  description: string
  priority: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface BenefitRequiredDocument {
  id: string
  benefit_id: string
  document_id: string
  document_name: string
  created_at: string
}

export interface StudentBenefit {
  id: string
  student_id: string
  benefit_id: string
  assigned_by: string
  assigned_at: string
}
