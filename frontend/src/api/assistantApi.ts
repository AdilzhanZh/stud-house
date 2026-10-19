import { apiClient } from './client'

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  created_at: string
}

export interface ChatConversation {
  enabled: boolean
  conversation_id: string | null
  messages: ChatMessage[]
}

export async function getAssistantConversation(): Promise<ChatConversation> {
  const { data } = await apiClient.get<{ data: ChatConversation }>('/assistant/conversation')
  return data.data
}

// conversationId null starts a new conversation. Replies can take a while:
// the assistant may look several things up before answering.
export async function sendAssistantMessage(
  conversationId: string | null,
  message: string,
): Promise<{ conversation_id: string; reply: ChatMessage }> {
  const { data } = await apiClient.post<{ data: { conversation_id: string; reply: ChatMessage } }>(
    '/assistant/messages',
    { conversation_id: conversationId, message },
    { timeout: 180_000 },
  )
  return data.data
}
