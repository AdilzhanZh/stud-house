import { apiClient } from './client'
import type { Payment } from '../types/payments'

export async function listMyPayments(): Promise<Payment[]> {
  const { data } = await apiClient.get<{ data: Payment[] }>('/payments/my')
  return data.data
}

export async function getPaymentByContract(contractId: string): Promise<Payment> {
  const { data } = await apiClient.get<{ data: Payment }>(`/contracts/${contractId}/payment`)
  return data.data
}

export async function submitPayment(id: string, receiptFileUrl: string): Promise<Payment> {
  const { data } = await apiClient.post<{ data: Payment }>(`/payments/${id}/submit`, {
    receipt_file_url: receiptFileUrl,
  })
  return data.data
}
