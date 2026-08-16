import { apiClient } from './client'
import type { RequiredDocument } from '../types/documents'

export async function listRequiredDocuments(): Promise<RequiredDocument[]> {
  const { data } = await apiClient.get<{ data: RequiredDocument[] }>('/documents')
  return data.data
}

export async function createRequiredDocument(nameKk: string, nameRu: string): Promise<RequiredDocument> {
  const { data } = await apiClient.post<{ data: RequiredDocument }>('/documents', {
    name_kk: nameKk,
    name_ru: nameRu,
  })
  return data.data
}

export async function deleteRequiredDocument(id: string): Promise<void> {
  await apiClient.delete(`/documents/${id}`)
}
