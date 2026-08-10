import type { GroceryItem, ItemComment, ItemEvent, ItemStatus, Priority } from '../../domain/item'
import { request } from './transport'

export interface StatusFlow {
  status: ItemStatus
  label: string
  next: ItemStatus[]
}

export interface QuickEntry {
  name: string
  quantity: number
  unit: string
}

export interface CreateItemInput {
  name: string
  quantity: number
  unit: string
  priority: Priority
  requestedBy: string
  note?: string
  category?: string
  price?: number
  section?: string
}

export interface ItemFilters {
  search?: string
  status?: ItemStatus
  category?: string
  priority?: Priority
  section?: string
  requestedBy?: string
  assignedTo?: string
  store?: string
  urgent?: boolean
  onlyComments?: boolean
  onlyPhotos?: boolean
  sort?: ItemSort
}

export type ItemSort = 'manual' | 'priority' | 'name' | 'category' | 'requestedBy' | 'price' | 'store'

export const ITEM_SORT_LABEL: Record<ItemSort, string> = {
  manual: 'Orden manual',
  priority: 'Prioridad',
  name: 'Nombre',
  category: 'Categoría',
  requestedBy: 'Quién lo pidió',
  price: 'Precio',
  store: 'Tienda',
}

export interface UpdateItemInput {
  by: string
  name?: string
  quantity?: number
  unit?: string
  priority?: Priority
  note?: string
  category?: string
}

export type MoveDirection = 'up' | 'down'

export function getItemFlows(): Promise<StatusFlow[]> {
  return request<StatusFlow[]>('item_flows')
}

export function itemTransition(from: ItemStatus, to: ItemStatus): Promise<ItemStatus> {
  return request<ItemStatus>('item_transition', { from, to })
}

export function parseQuickEntry(text: string): Promise<QuickEntry> {
  return request<QuickEntry>('parse_quick_entry', { text })
}

export function validateNewItem(name: string, quantity: number, unit: string): Promise<void> {
  return request<void>('validate_new_item', { name, quantity, unit })
}

export function listItems(): Promise<GroceryItem[]> {
  return request<GroceryItem[]>('items_list')
}

export function createItem(input: CreateItemInput): Promise<GroceryItem> {
  return request<GroceryItem>('item_create', {
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    priority: input.priority,
    requestedBy: input.requestedBy,
    note: input.note ?? null,
    category: input.category ?? null,
    price: input.price ?? null,
    section: input.section ?? null,
  })
}

export function queryItems(filters: ItemFilters = {}): Promise<GroceryItem[]> {
  return request<GroceryItem[]>('items_query', {
    search: filters.search ?? null,
    status: filters.status ?? null,
    category: filters.category ?? null,
    priority: filters.priority ?? null,
    section: filters.section ?? null,
    requestedBy: filters.requestedBy ?? null,
    assignedTo: filters.assignedTo ?? null,
    store: filters.store ?? null,
    urgent: filters.urgent ?? false,
    onlyComments: filters.onlyComments ?? false,
    onlyPhotos: filters.onlyPhotos ?? false,
    sort: filters.sort ?? null,
  })
}

export function getItem(id: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_get', { id })
}

export function updateItem(id: string, input: UpdateItemInput): Promise<GroceryItem> {
  return request<GroceryItem>('item_update', {
    id,
    by: input.by,
    name: input.name ?? null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    priority: input.priority ?? null,
    note: input.note ?? null,
    category: input.category ?? null,
  })
}

export function setItemPriority(
  id: string,
  priority: Priority,
  by: string,
): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_priority', { id, priority, by })
}

export function moveItem(id: string, direction: MoveDirection): Promise<GroceryItem> {
  return request<GroceryItem>('item_move', { id, direction })
}

export function deleteItem(id: string): Promise<void> {
  return request<void>('item_delete', { id })
}

export function changeItemStatus(id: string, to: ItemStatus, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_change_status', { id, to, by })
}

export function assignItem(id: string, member: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_assign', { id, member, by })
}

export function cancelItem(id: string, by: string, reason?: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_cancel', { id, by, reason: reason ?? null })
}

export function getItemHistory(id: string): Promise<ItemEvent[]> {
  return request<ItemEvent[]>('item_history', { id })
}

export function addItemComment(id: string, by: string, body: string): Promise<ItemComment> {
  return request<ItemComment>('item_add_comment', { id, by, body })
}

export function setItemPrice(id: string, price: number): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_price', { id, price })
}

export function setItemSection(id: string, section: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_section', { id, section })
}

export function setItemStore(id: string, storeName: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_store', { id, storeName })
}

export function addItemPhoto(id: string, photo: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_add_photo', { id, photo })
}

export function removeItemPhoto(id: string, index: number): Promise<GroceryItem> {
  return request<GroceryItem>('item_remove_photo', { id, index })
}

export function recoverItem(id: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_recover', { id, by })
}

/** Ítems comprados entre dos marcas ISO — "comprar lo mismo de la semana pasada" (§8.2). */
export function getItemsPurchasedBetween(start: string, end: string): Promise<GroceryItem[]> {
  return request<GroceryItem[]>('items_purchased_between', { start, end })
}
