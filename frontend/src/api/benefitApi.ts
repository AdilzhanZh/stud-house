import { apiClient } from './client'
import type { Benefit, BenefitRequiredDocument, StudentBenefit } from '../types/benefits'

export async function listBenefits(): Promise<Benefit[]> {
  const { data } = await apiClient.get<{ data: Benefit[] }>('/benefits')
  return data.data
}

export async function getBenefit(id: string): Promise<Benefit> {
  const { data } = await apiClient.get<{ data: Benefit }>(`/benefits/${id}`)
  return data.data
}

export interface BenefitPayload {
  name_kk: string
  name_ru: string
  description_kk: string
  description_ru: string
  priority: number
}

export async function createBenefit(payload: BenefitPayload): Promise<Benefit> {
  const { data } = await apiClient.post<{ data: Benefit }>('/benefits', payload)
  return data.data
}

export async function updateBenefit(id: string, payload: BenefitPayload): Promise<Benefit> {
  const { data } = await apiClient.patch<{ data: Benefit }>(`/benefits/${id}`, payload)
  return data.data
}

export async function deleteBenefit(id: string): Promise<void> {
  await apiClient.delete(`/benefits/${id}`)
}

export async function listBenefitRequiredDocuments(
  benefitId: string,
): Promise<BenefitRequiredDocument[]> {
  const { data } = await apiClient.get<{ data: BenefitRequiredDocument[] }>(
    `/benefits/${benefitId}/documents`,
  )
  return data.data
}

export async function addBenefitRequiredDocument(
  benefitId: string,
  documentId: string,
): Promise<BenefitRequiredDocument> {
  const { data } = await apiClient.post<{ data: BenefitRequiredDocument }>(
    `/benefits/${benefitId}/documents`,
    { document_id: documentId },
  )
  return data.data
}

export async function deleteBenefitRequiredDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/benefit-documents/${documentId}`)
}

// Student self-declares that a benefit applies to them (e.g. while
// submitting a dormitory application) — distinct from the admin/manager
// assigning a benefit on the student's behalf.
export async function assignOwnBenefit(benefitId: string): Promise<void> {
  await apiClient.post('/students/me/benefits', { benefit_id: benefitId })
}

export async function listStudentBenefits(studentId: string): Promise<StudentBenefit[]> {
  const { data } = await apiClient.get<{ data: StudentBenefit[] }>(
    `/students/${studentId}/benefits`,
  )
  return data.data
}
