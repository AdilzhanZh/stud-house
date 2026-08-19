import { apiClient } from './client'
import type { User } from '../types'

export async function updateAvatar(userId: string, avatarUrl: string): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(`/users/${userId}/avatar`, {
    avatar_url: avatarUrl,
  })
  return data.data
}

export async function changeOwnPassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.patch('/users/me/password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}

export async function changeOwnEmail(newEmail: string): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>('/users/me/email', { new_email: newEmail })
  return data.data
}
