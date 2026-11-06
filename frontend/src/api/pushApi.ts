import { apiClient } from './client'

export interface PushConfig {
  enabled: boolean
  public_key: string
}

export async function getPushConfig(): Promise<PushConfig> {
  const { data } = await apiClient.get<{ data: PushConfig }>('/push/config')
  return data.data
}

export async function savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  await apiClient.post('/push/subscriptions', subscription)
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await apiClient.delete('/push/subscriptions', { data: { endpoint } })
}
