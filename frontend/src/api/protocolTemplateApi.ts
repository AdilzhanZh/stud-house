import { apiClient } from './client'

export interface ProtocolVariable {
  token: string
  label: string
}

export interface ProtocolTemplate {
  pages: string[]
  updated_at: string | null
  variables?: ProtocolVariable[]
}

export async function getProtocolTemplate(): Promise<ProtocolTemplate> {
  const { data } = await apiClient.get<{ data: ProtocolTemplate }>('/protocol-template')
  return data.data
}

export async function updateProtocolTemplate(pages: string[]): Promise<ProtocolTemplate> {
  const { data } = await apiClient.put<{ data: ProtocolTemplate }>('/protocol-template', { pages })
  return data.data
}
