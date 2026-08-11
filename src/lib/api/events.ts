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

export function deleteEvent(id: string): Promise<void> {
  return request<void>('event_delete', { id })
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
