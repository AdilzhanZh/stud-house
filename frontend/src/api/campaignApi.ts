import { apiClient } from './client'
import type { CampaignStats } from '../types/campaign'

export async function getCampaignStats(): Promise<CampaignStats> {
  const { data } = await apiClient.get<{ data: CampaignStats }>('/campaign-stats')
  return data.data
}
