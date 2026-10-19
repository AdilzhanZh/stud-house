export type CampaignStage =
  | 'awaiting_review'
  | 'awaiting_documents'
  | 'awaiting_commission'
  | 'awaiting_confirmation'
  | 'confirmation_overdue'
  | 'settled'
  | 'rejected'
  | 'contract_declined'

export interface DormitoryCampaign {
  dormitory_id: string
  dormitory_name: string
  total_capacity: number
  room_beds: number
  residents: number
  held: number
  free_beds: number
  submitted: number
  awaiting_review: number
}

// Aggregate progress of the current intake campaign (backend
// service.CampaignService). Open stages count every application still
// waiting on someone; submitted/reviewed and closed stages only count
// those submitted since campaign_start.
export interface CampaignStats {
  campaign_start: string
  submitted: number
  reviewed: number
  stages: Partial<Record<CampaignStage, number>>
  triage: { green: number; yellow: number; red: number }
  daily: { day: string; count: number }[]
  dormitories: DormitoryCampaign[]
}
