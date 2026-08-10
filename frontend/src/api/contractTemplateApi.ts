import { apiClient } from './client'

export type ContractLanguage = 'kk' | 'ru'

export interface ContractVariable {
  token: string
  label: string
}

export interface ContractTemplate {
  language: ContractLanguage
  pages: string[]
  updated_at: string | null
  variables?: ContractVariable[]
}

export async function getContractTemplate(language: ContractLanguage): Promise<ContractTemplate> {
  const { data } = await apiClient.get<{ data: ContractTemplate }>('/contract-template', {
    params: { language },
  })
  return data.data
}

export async function updateContractTemplate(language: ContractLanguage, pages: string[]): Promise<ContractTemplate> {
  const { data } = await apiClient.put<{ data: ContractTemplate }>(
    '/contract-template',
    { pages },
    { params: { language } },
  )
  return data.data
}
