import { apiClient } from './client'
import type { Contract, ContractStatus } from '../types/contracts'

export async function listContracts(status?: ContractStatus): Promise<Contract[]> {
  const { data } = await apiClient.get<{ data: Contract[] }>('/contracts', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export interface ManagerDecisionPayload {
  action: 'void' | 'extend'
  new_deadline?: string
}

export async function contractManagerDecision(
  id: string,
  payload: ManagerDecisionPayload,
): Promise<Contract> {
  const { data } = await apiClient.patch<{ data: Contract }>(
    `/contracts/${id}/manager-decision`,
    payload,
  )
  return data.data
}
