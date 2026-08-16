export interface Benefit {
  id: string
  name_kk: string
  name_ru: string
  description_kk: string
  description_ru: string
  priority: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface BenefitRequiredDocument {
  id: string
  benefit_id: string
  document_id: string
  document_name_kk: string
  document_name_ru: string
  created_at: string
}

export interface StudentBenefit {
  id: string
  student_id: string
  benefit_id: string
  assigned_by: string
  assigned_at: string
}
