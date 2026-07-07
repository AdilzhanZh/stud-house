import { apiClient } from './client'
import type { Benefit, BenefitField, BenefitRequiredDocument } from '../types/benefits'

export async function listBenefits(): Promise<Benefit[]> {
  const { data } = await apiClient.get<{ data: Benefit[] }>('/benefits')
  return data.data
}

export async function getBenefit(id: string): Promise<Benefit> {
  const { data } = await apiClient.get<{ data: Benefit }>(`/benefits/${id}`)
  return data.data
}

export interface BenefitPayload {
  name: string
  description: string
}

export async function createBenefit(payload: BenefitPayload): Promise<Benefit> {
  const { data } = await apiClient.post<{ data: Benefit }>('/benefits', payload)
  return data.data
}

export async function updateBenefit(id: string, payload: BenefitPayload): Promise<Benefit> {
  const { data } = await apiClient.patch<{ data: Benefit }>(`/benefits/${id}`, payload)
  return data.data
}

export async function listBenefitFields(benefitId: string): Promise<BenefitField[]> {
  const { data } = await apiClient.get<{ data: BenefitField[] }>(`/benefits/${benefitId}/fields`)
  return data.data
}

export async function addBenefitField(
  benefitId: string,
  fieldName: string,
  fieldType: string,
): Promise<BenefitField> {
  const { data } = await apiClient.post<{ data: BenefitField }>(`/benefits/${benefitId}/fields`, {
    field_name: fieldName,
    field_type: fieldType,
  })
  return data.data
}

export async function deleteBenefitField(fieldId: string): Promise<void> {
  await apiClient.delete(`/benefit-fields/${fieldId}`)
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
  documentName: string,
): Promise<BenefitRequiredDocument> {
  const { data } = await apiClient.post<{ data: BenefitRequiredDocument }>(
    `/benefits/${benefitId}/documents`,
    { document_name: documentName },
  )
  return data.data
}

export async function deleteBenefitRequiredDocument(documentId: string): Promise<void> {
  await apiClient.delete(`/benefit-documents/${documentId}`)
}
