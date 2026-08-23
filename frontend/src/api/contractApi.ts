import { apiClient } from './client'
import type { Contract } from '../types/contracts'

export async function listMyContracts(): Promise<Contract[]> {
  const { data } = await apiClient.get<{ data: Contract[] }>('/contracts/my')
  return data.data
}

// Available to the owning student or admin/manager — used by the
// application journey stepper to tell whether an approved application has
// a contract yet, and if so whether it's still awaiting the student's
// response.
export async function getContractByApplication(applicationId: string): Promise<Contract> {
  const { data } = await apiClient.get<{ data: Contract }>(`/applications/${applicationId}/contract`)
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
