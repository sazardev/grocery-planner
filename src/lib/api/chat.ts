import type { ChatMessage, SendMessageInput } from '../../domain/chat'
import { request } from './transport'

export function listChat(): Promise<ChatMessage[]> {
  return request<ChatMessage[]>('chat_list')
}

export function sendChatMessage(input: SendMessageInput): Promise<ChatMessage> {
  return request<ChatMessage>('chat_send', {
    by: input.by,
    body: input.body,
    photo: input.photo ?? null,
    itemId: input.itemId ?? null,
  })
}

export function reactToMessage(id: string, emoji: string, by: string): Promise<ChatMessage> {
  return request<ChatMessage>('chat_react', { id, emoji, by })
}

export function togglePinnedMessage(id: string): Promise<ChatMessage> {
  return request<ChatMessage>('chat_pin', { id })
}

export function getChatCount(): Promise<number> {
  return request<number>('chat_count')
}
