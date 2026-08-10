import { apiClient } from './client'

export interface PetitionVariable {
  token: string
  label: string
}

export interface PetitionTemplate {
  pages: string[]
  updated_at: string | null
  variables?: PetitionVariable[]
}

export async function getPetitionTemplate(): Promise<PetitionTemplate> {
  const { data } = await apiClient.get<{ data: PetitionTemplate }>('/petition-template')
  return data.data
}

export async function updatePetitionTemplate(pages: string[]): Promise<PetitionTemplate> {
  const { data } = await apiClient.put<{ data: PetitionTemplate }>('/petition-template', { pages })
  return data.data
}
