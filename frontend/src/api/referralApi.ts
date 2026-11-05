import { apiClient } from './client'
import type { Referral } from '../types/referrals'

export async function getMyReferral(): Promise<Referral> {
  const { data } = await apiClient.get<{ data: Referral }>('/referrals/my')
  return data.data
}

// Public: this is what the QR code on a referral leads to.
export async function verifyReferral(token: string): Promise<Referral> {
  const { data } = await apiClient.get<{ data: Referral }>(`/referrals/verify/${encodeURIComponent(token)}`)
  return data.data
}
