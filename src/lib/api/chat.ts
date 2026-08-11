import type { ChatMessage, MessageRefKind, SendMessageInput } from '../../domain/chat'
import { request } from './transport'

export interface ChatPageResult {
  messages: ChatMessage[]
  hasMore: boolean
}

export interface ChatSearchInput {
  query?: string
  by?: string
  refKind?: MessageRefKind
  hasPhoto?: boolean
  limit?: number
}

export interface ChatSearchResult {
  messages: ChatMessage[]
  total: number
}

export function listChat(): Promise<ChatMessage[]> {
  return request<ChatMessage[]>('chat_list')
}

export function chatPage(limit: number, before?: string): Promise<ChatPageResult> {
  const args: Record<string, unknown> = { limit }
  if (before) args.before = before
  return request<ChatPageResult>('chat_page', args)
}

export function chatSearch(input: ChatSearchInput): Promise<ChatSearchResult> {
  const args: Record<string, unknown> = {}
  if (input.query) args.query = input.query
  if (input.by) args.by = input.by
  if (input.refKind) args.refKind = input.refKind
  if (input.hasPhoto != null) args.hasPhoto = input.hasPhoto
  if (input.limit != null) args.limit = input.limit
  return request<ChatSearchResult>('chat_search', args)
}

export function sendChatMessage(input: SendMessageInput): Promise<ChatMessage> {
  return request<ChatMessage>('chat_send', {
    by: input.by,
    body: input.body,
    photo: input.photo ?? null,
    itemId: input.itemId ?? null,
    refs: input.refs ?? [],
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

/** Mensajes del chat que citan a un ítem (SPEC §11.3). */
export function getChatForItem(itemId: string): Promise<ChatMessage[]> {
  return request<ChatMessage[]>('chat_for_item', { itemId })
}
