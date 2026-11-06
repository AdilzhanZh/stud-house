import { apiClient } from './client'

// Groups of users the AI assistant can be opened to. A user may be in
// several (a manager who is also a commission member) and gets the
// assistant when any of them is allowed.
export type AssistantAudience = 'student' | 'staff' | 'manager' | 'committee' | 'admin'

// Who may use the AI assistant — the only AI setting an admin controls.
// The model, limits and API key are fixed on the server.
export interface AssistantAccess {
  api_key_configured: boolean
  model: string
  audiences: AssistantAudience[]
  all_audiences: AssistantAudience[]
  updated_by: string | null
  updated_at: string | null
}

export async function getAssistantAccess(): Promise<AssistantAccess> {
  const { data } = await apiClient.get<{ data: AssistantAccess }>('/admin/assistant-access')
  return data.data
}

export async function updateAssistantAccess(audiences: AssistantAudience[]): Promise<AssistantAccess> {
  const { data } = await apiClient.put<{ data: AssistantAccess }>('/admin/assistant-access', { audiences })
  return data.data
}
