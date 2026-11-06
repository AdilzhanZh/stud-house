import { apiClient } from './client'
import type { ResidenceCertificate } from '../types/residenceCertificates'

export async function getMyResidenceCertificate(): Promise<ResidenceCertificate> {
  const { data } = await apiClient.get<{ data: ResidenceCertificate }>('/residence-certificates/my')
  return data.data
}

export async function issueResidenceCertificate(): Promise<ResidenceCertificate> {
  const { data } = await apiClient.post<{ data: ResidenceCertificate }>('/residence-certificates')
  return data.data
}

// Public: this is what the QR code on a certificate leads to.
export async function verifyResidenceCertificate(token: string): Promise<ResidenceCertificate> {
  const { data } = await apiClient.get<{ data: ResidenceCertificate }>(
    `/residence-certificates/verify/${encodeURIComponent(token)}`,
  )
  return data.data
}
