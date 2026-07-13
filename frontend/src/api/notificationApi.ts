import { apiClient } from './client'
import type { Notification } from '../types/notifications'

export async function listNotifications(): Promise<Notification[]> {
  const { data } = await apiClient.get<{ data: Notification[] }>('/notifications')
  return data.data
}

export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(`/notifications/${id}/read`)
}

export async function deleteNotification(id: string): Promise<void> {
  await apiClient.delete(`/notifications/${id}`)
}

export async function clearAllNotifications(): Promise<void> {
  await apiClient.delete('/notifications')
}
