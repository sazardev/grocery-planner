import type { GroceryItem, ItemComment, ItemEvent, ItemFallback, ItemStatus, Priority } from '../../domain/item'
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

export interface FallbackInput {
  name: string
  quantity: number
  unit: string
  note?: string
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
  store?: string
  brand?: string
  quantityMax?: number
  fallbacks?: FallbackInput[]
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
  aisle?: string
  createdFrom?: string
  createdTo?: string
  urgent?: boolean
  onlyComments?: boolean
  onlyPhotos?: boolean
  sort?: ItemSort
}

export type ItemSort = 'manual' | 'priority' | 'name' | 'category' | 'requestedBy' | 'price' | 'store' | 'aisle'

export const ITEM_SORT_LABEL: Record<ItemSort, string> = {
  manual: 'Orden manual',
  priority: 'Prioridad',
  name: 'Nombre',
  category: 'Categoría',
  requestedBy: 'Quién lo pidió',
  price: 'Precio',
  store: 'Tienda',
  aisle: 'Pasillo',
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

export interface ItemSuggestion {
  name: string
  quantity: number
  unit: string
  category?: string
  timesBought: number
  lastBoughtAt?: string
}

/** Sugerencias de ítems que la familia ya compró (SPEC §4.2). */
export function suggestItems(query: string): Promise<ItemSuggestion[]> {
  return request<ItemSuggestion[]>('items_suggest', { query })
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
    store: input.store ?? null,
    brand: input.brand ?? null,
    quantityMax: input.quantityMax ?? null,
    fallbacks: input.fallbacks ?? [],
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
    aisle: filters.aisle ?? null,
    createdFrom: filters.createdFrom ?? null,
    createdTo: filters.createdTo ?? null,
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

export function moveItem(id: string, direction: MoveDirection, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_move', { id, direction, by })
}

/** "Elimina" un ítem (soft delete: el historial se conserva, SPEC §8). */
export function deleteItem(id: string, by: string): Promise<void> {
  return request<void>('item_delete', { id, by })
}

/** Borrado físico de un ítem que ya está en la papelera (limpieza real). */
export function deleteItemPermanent(id: string, by: string): Promise<void> {
  return request<void>('item_delete_permanent', { id, by })
}

export function changeItemStatus(id: string, to: ItemStatus, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_change_status', { id, to, by })
}

/** Marca todo lo que está "ya lo llevo" como comprado de golpe (SPEC §5.1). */
export function completeCarriedItems(by: string): Promise<GroceryItem[]> {
  return request<GroceryItem[]>('items_complete_batch', { by })
}

export function assignItem(id: string, member: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_assign', { id, member, by })
}

export function unassignItem(id: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_unassign', { id, by })
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

export function setItemPrice(id: string, price: number, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_price', { id, price, by })
}

export function setItemSection(id: string, section: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_section', { id, section, by })
}

export function setItemStore(id: string, storeName: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_store', { id, storeName, by })
}

export function setItemAisle(id: string, aisle: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_aisle', { id, aisle, by })
}

export function setItemBrand(id: string, brand: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_brand', { id, brand, by })
}

export function setItemQuantityMax(
  id: string,
  max: number | null,
  by: string,
): Promise<GroceryItem> {
  return request<GroceryItem>('item_set_quantity_max', { id, max, by })
}

export function addItemFallback(
  id: string,
  fb: FallbackInput,
  by: string,
): Promise<ItemFallback> {
  return request<ItemFallback>('item_add_fallback', { id, ...fb, by })
}

export function removeItemFallback(id: string, index: number, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_remove_fallback', { id, index, by })
}

export function applyItemFallback(id: string, index: number, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_use_fallback', { id, index, by })
}

export function addItemPhoto(id: string, photo: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_add_photo', { id, photo, by })
}

export function removeItemPhoto(id: string, index: number, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_remove_photo', { id, index, by })
}

export function recoverItem(id: string, by: string): Promise<GroceryItem> {
  return request<GroceryItem>('item_recover', { id, by })
}

/** Ítems comprados entre dos marcas ISO — "comprar lo mismo de la semana pasada" (§8.2). */
export function getItemsPurchasedBetween(start: string, end: string): Promise<GroceryItem[]> {
  return request<GroceryItem[]>('items_purchased_between', { start, end })
}
