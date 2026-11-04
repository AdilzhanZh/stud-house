import { apiClient } from './client'

export interface PetitionVariable {
  token: string
  label: string
}

export interface PetitionTemplate {
  pages: string[]
  two_pages_per_sheet: boolean
  updated_at: string | null
  variables?: PetitionVariable[]
}

export async function getPetitionTemplate(): Promise<PetitionTemplate> {
  const { data } = await apiClient.get<{ data: PetitionTemplate }>('/petition-template')
  return data.data
}

export async function updatePetitionTemplate(pages: string[], twoPagesPerSheet: boolean): Promise<PetitionTemplate> {
  const { data } = await apiClient.put<{ data: PetitionTemplate }>('/petition-template', {
    pages,
    two_pages_per_sheet: twoPagesPerSheet,
  })
  return data.data
}
