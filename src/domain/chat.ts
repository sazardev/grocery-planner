export type ChatMessageKind = 'user' | 'system'

export interface Reaction {
  emoji: string
  by: string
  at: string
}

export interface ChatMessage {
  id: string
  at: string
  by: string
  kind: ChatMessageKind
  body: string
  itemId?: string
  itemName?: string
  photo?: string
  mentions: string[]
  reactions: Reaction[]
  pinned: boolean
}

export interface SendMessageInput {
  by: string
  body: string
  photo?: string
  itemId?: string
}
