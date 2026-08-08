export type ItemStatus = 'falta' | 'pedido' | 'llevo' | 'comprado' | 'cancelado'

export type Priority = 'baja' | 'media' | 'alta' | 'urgente'

export type ItemEventKind =
  | { type: 'created' }
  | { type: 'status_changed'; from: ItemStatus; to: ItemStatus }
  | { type: 'assigned'; member: string }
  | { type: 'cancelled'; from: ItemStatus; reason: string | null }
  | { type: 'commented'; body: string }
  | { type: 'updated'; fields: string[] }
  | { type: 'priority_changed'; from: Priority; to: Priority }

export interface ItemEvent {
  at: string
  by: string
  kind: ItemEventKind
}

export interface ItemComment {
  id: string
  at: string
  by: string
  body: string
}

export interface GroceryItem {
  id: string
  name: string
  quantity: number
  unit: string
  status: ItemStatus
  priority: Priority
  requestedBy: string
  assignedTo?: string
  note?: string
  category?: string
  price?: number
  section?: string
  store?: string
  photos: string[]
  createdAt: string
  history: ItemEvent[]
  comments: ItemComment[]
}

export const STATUS_LABEL: Record<ItemStatus, string> = {
  falta: 'Falta',
  pedido: 'Pedido',
  llevo: 'Ya lo llevo',
  comprado: 'Comprado',
  cancelado: 'Cancelado',
}
