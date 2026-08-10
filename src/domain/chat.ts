export type ChatMessageKind = 'user' | 'system'

export type MessageRefKind = 'item' | 'event' | 'trip'

export interface MessageRef {
  kind: MessageRefKind
  id: string
  name: string
}

export interface RefInput {
  kind: MessageRefKind
  id: string
}

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
  refs: MessageRef[]
  reactions: Reaction[]
  pinned: boolean
}

export interface SendMessageInput {
  by: string
  body: string
  photo?: string
  itemId?: string
  refs?: RefInput[]
}
