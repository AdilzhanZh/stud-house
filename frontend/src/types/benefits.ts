export interface Benefit {
  id: string
  name: string
  description: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface BenefitField {
  id: string
  benefit_id: string
  field_name: string
  field_type: string
  created_at: string
}

export interface BenefitRequiredDocument {
  id: string
  benefit_id: string
  document_name: string
  created_at: string
}
