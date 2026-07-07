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
