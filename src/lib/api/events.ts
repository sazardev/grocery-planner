import type { Event, EventType } from '../../domain/event'
import { request } from './transport'

export interface CreateEventInput {
  title: string
  date: string
  time?: string
  allDay?: boolean
  kind: EventType
  place?: string
  participants?: string[]
  note?: string
  recurringYearly?: boolean
  reminderMinutes?: number
  createdBy: string
}

export function listEvents(): Promise<Event[]> {
  return request<Event[]>('events_list')
}

export function listEventsInRange(start: string, end: string): Promise<Event[]> {
  return request<Event[]>('events_list_range', { start, end })
}

export function createEvent(input: CreateEventInput): Promise<Event> {
  return request<Event>('event_create', {
    title: input.title,
    date: input.date,
    time: input.time ?? null,
    allDay: input.allDay ?? false,
    kind: input.kind,
    place: input.place ?? null,
    participants: input.participants ?? [],
    note: input.note ?? null,
    recurringYearly: input.recurringYearly ?? false,
    reminderMinutes: input.reminderMinutes ?? null,
    createdBy: input.createdBy,
  })
}

export function getEvent(id: string): Promise<Event> {
  return request<Event>('event_get', { id })
}

export interface UpdateEventInput {
  by: string
  title?: string
  date?: string
  time?: string
  allDay?: boolean
  kind?: EventType
  place?: string
  participants?: string[]
  note?: string
  recurringYearly?: boolean
  reminderMinutes?: number | null
}

/** Edita un evento (SPEC §9.3); cambiar la fecha lo mueve. */
export function updateEvent(id: string, input: UpdateEventInput): Promise<Event> {
  return request<Event>('event_update', {
    id,
    by: input.by,
    title: input.title ?? null,
    date: input.date ?? null,
    time: input.time ?? null,
    allDay: input.allDay ?? null,
    kind: input.kind ?? null,
    place: input.place ?? null,
    participants: input.participants ?? null,
    note: input.note ?? null,
    recurringYearly: input.recurringYearly ?? null,
    reminderMinutes: input.reminderMinutes ?? null,
  })
}

export function deleteEvent(id: string, by: string): Promise<void> {
  return request<void>('event_delete', { id, by })
}

export function addItemToEvent(id: string, itemId: string): Promise<Event> {
  return request<Event>('event_add_item', { id, itemId })
}

export function removeItemFromEvent(id: string, itemId: string): Promise<Event> {
  return request<Event>('event_remove_item', { id, itemId })
}

/** Fusiona la lista del evento a la lista del hogar (SPEC §9.4). */
export function mergeEventListToHome(id: string): Promise<Event> {
  return request<Event>('event_merge_to_home', { id })
}

/** Descarta la lista del evento: borra sus ítems de la lista del hogar. */
export function discardEventList(id: string): Promise<Event> {
  return request<Event>('event_discard_list', { id })
}
