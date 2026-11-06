import { apiClient } from './client'

export interface ReferralVariable {
  token: string
  label: string
}

export interface ReferralTemplate {
  pages: string[]
  updated_at: string | null
  variables?: ReferralVariable[]
}

export async function getReferralTemplate(): Promise<ReferralTemplate> {
  const { data } = await apiClient.get<{ data: ReferralTemplate }>('/referral-template')
  return data.data
}

export async function updateReferralTemplate(pages: string[]): Promise<ReferralTemplate> {
  const { data } = await apiClient.put<{ data: ReferralTemplate }>('/referral-template', { pages })
  return data.data
}
