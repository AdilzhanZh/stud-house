import { apiClient } from './client'
import type { Role, User } from '../types'

export async function listUsers(role?: Role): Promise<User[]> {
  const { data } = await apiClient.get<{ data: User[] }>('/admin/users', {
    params: role ? { role } : undefined,
  })
  return data.data
}

export interface CreateUserPayload {
  full_name: string
  email: string
  phone: string
  password: string
  role: Role
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const { data } = await apiClient.post<{ data: User }>('/admin/users', payload)
  return data.data
}

export async function updateUserRole(id: string, role: Role): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(`/admin/users/${id}/role`, { role })
  return data.data
}

export async function setChairperson(id: string, isChairperson: boolean): Promise<User> {
  const { data } = await apiClient.patch<{ data: User }>(
    `/admin/committee-members/${id}/chairperson`,
    { is_chairperson: isChairperson },
  )
  return data.data
}
