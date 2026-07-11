import { apiClient } from './client'
import type { Payment, PaymentStatus } from '../types/payments'

export async function listPayments(status?: PaymentStatus): Promise<Payment[]> {
  const { data } = await apiClient.get<{ data: Payment[] }>('/payments', {
    params: status ? { status } : undefined,
  })
  return data.data
}

export async function confirmPayment(
  id: string,
  action: 'confirm' | 'reject',
): Promise<Payment> {
  const { data } = await apiClient.patch<{ data: Payment }>(`/payments/${id}/confirm`, { action })
  return data.data
}

export interface PaymentManagerDecisionPayload {
  action: 'void' | 'extend'
  new_deadline?: string
}

export async function paymentManagerDecision(
  id: string,
  payload: PaymentManagerDecisionPayload,
): Promise<Payment> {
  const { data } = await apiClient.patch<{ data: Payment }>(
    `/payments/${id}/manager-decision`,
    payload,
  )
  return data.data
}
