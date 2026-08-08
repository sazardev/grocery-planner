export type EventType =
  | 'cumpleanos'
  | 'union'
  | 'comida'
  | 'celebracion'
  | 'reunion'
  | 'mandado'

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  cumpleanos: 'Cumpleaños',
  union: 'Unión / aniversario',
  comida: 'Comida familiar',
  celebracion: 'Celebración',
  reunion: 'Reunión / visita',
  mandado: 'Mandado / plan',
}

export interface Event {
  id: string
  title: string
  date: string
  time?: string
  allDay: boolean
  kind: EventType
  place?: string
  participants: string[]
  note?: string
  recurringYearly: boolean
  createdBy: string
  createdAt: string
  itemIds: string[]
}
