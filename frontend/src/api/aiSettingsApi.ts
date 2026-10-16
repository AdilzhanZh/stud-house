import { apiClient } from './client'

export interface AISettings {
  // An AI API key is set on the server (the key itself is never sent);
  // provider says whose: '' when there is none.
  api_key_configured: boolean
  provider: 'anthropic' | 'openrouter' | ''
  assistant_enabled: boolean
  assistant_model: string
  assistant_effort: string
  assistant_daily_limit: number
  document_checks_enabled: boolean
  document_check_model: string
  updated_by: string | null
  updated_at: string | null
  // Suggestions only — any model id may be typed in.
  models: string[]
  efforts: string[]
}

export type AISettingsUpdate = Pick<
  AISettings,
  | 'assistant_enabled'
  | 'assistant_model'
  | 'assistant_effort'
  | 'assistant_daily_limit'
  | 'document_checks_enabled'
  | 'document_check_model'
>

export async function getAISettings(): Promise<AISettings> {
  const { data } = await apiClient.get<{ data: AISettings }>('/admin/ai-settings')
  return data.data
}

export async function updateAISettings(payload: AISettingsUpdate): Promise<AISettings> {
  const { data } = await apiClient.put<{ data: AISettings }>('/admin/ai-settings', payload)
  return data.data
}
