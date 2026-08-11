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
  | { type: 'fallback_used'; from: string; to: string }
  | { type: 'fallbacks_changed' }
  | { type: 'price_changed'; price: number }
  | { type: 'section_changed'; section: string }
  | { type: 'store_changed'; store: string }
  | { type: 'aisle_changed'; aisle: string }
  | { type: 'photos_changed' }
  | { type: 'deleted' }
  | { type: 'recovered' }

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

/** Una alternativa ordenada: "si no hay X, trae Y". */
export interface ItemFallback {
  name: string
  quantity: number
  unit: string
  note?: string
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
  brand?: string
  quantityMax?: number
  fallbacks: ItemFallback[]
  note?: string
  category?: string
  price?: number
  section?: string
  store?: string
  aisle?: string
  deleted?: boolean
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
