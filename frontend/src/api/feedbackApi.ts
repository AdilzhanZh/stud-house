import { apiClient } from './client'

export async function sendFeedback(message: string): Promise<void> {
  await apiClient.post('/feedback', { message })
}
