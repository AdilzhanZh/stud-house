import { apiClient } from './client'
import type { Contract } from '../types/contracts'

export async function listMyContracts(): Promise<Contract[]> {
  const { data } = await apiClient.get<{ data: Contract[] }>('/contracts/my')
  return data.data
}

export async function respondContract(
  id: string,
  action: 'accept' | 'decline',
): Promise<Contract> {
  const { data } = await apiClient.patch<{ data: Contract }>(`/contracts/${id}/respond`, {
    action,
  })
  return data.data
}
