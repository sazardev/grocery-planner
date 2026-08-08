import type { ShoppingTrip } from '../../domain/trip'
import { request } from './transport'

export interface CreateTripInput {
  title: string
  store?: string
  assignedTo?: string
  by: string
}

export function listTrips(): Promise<ShoppingTrip[]> {
  return request<ShoppingTrip[]>('trips_list')
}

export function createTrip(input: CreateTripInput): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_create', {
    title: input.title,
    store: input.store ?? null,
    assignedTo: input.assignedTo ?? null,
    by: input.by,
  })
}

export function getTrip(id: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_get', { id })
}

export function addItemToTrip(id: string, itemId: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_add_item', { id, itemId })
}

export function removeItemFromTrip(id: string, itemId: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_remove_item', { id, itemId })
}

export function assignTrip(id: string, member: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_assign', { id, member })
}

export function activateTrip(id: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_activate', { id })
}

export function completeTrip(id: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_complete', { id })
}

export function cancelTrip(id: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_cancel', { id })
}

export function confirmTripReceived(id: string, by: string): Promise<ShoppingTrip> {
  return request<ShoppingTrip>('trips_confirm_received', { id, by })
}
