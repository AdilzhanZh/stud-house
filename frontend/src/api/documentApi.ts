import { apiClient } from './client'
import type { RequiredDocument } from '../types/documents'

export async function listRequiredDocuments(): Promise<RequiredDocument[]> {
  const { data } = await apiClient.get<{ data: RequiredDocument[] }>('/documents')
  return data.data
}

export async function createRequiredDocument(
  nameKk: string,
  nameRu: string,
  validityDays: number | null = null,
): Promise<RequiredDocument> {
  const { data } = await apiClient.post<{ data: RequiredDocument }>('/documents', {
    name_kk: nameKk,
    name_ru: nameRu,
    validity_days: validityDays,
  })
  return data.data
}

export async function setRequiredDocumentValidity(id: string, validityDays: number | null): Promise<void> {
  await apiClient.patch(`/documents/${id}/validity`, { validity_days: validityDays })
}

export async function deleteRequiredDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`)
}
