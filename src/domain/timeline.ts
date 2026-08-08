export type TimelineKind =
  | 'item_created'
  | 'item_purchased'
  | 'item_cancelled'
  | 'item_commented'
  | 'item_assigned'
  | 'trip_created'
  | 'trip_completed'
  | 'plan_created'
  | 'event_created'

export interface TimelineEntry {
  at: string
  kind: TimelineKind
  title: string
  by: string
}

export const TIMELINE_KIND_LABEL: Record<TimelineKind, string> = {
  item_created: 'Se pidió',
  item_purchased: 'Se compró',
  item_cancelled: 'Se canceló',
  item_commented: 'Comentario',
  item_assigned: 'Asignación',
  trip_created: 'Mandado',
  trip_completed: 'Mandado completado',
  plan_created: 'Plan',
  event_created: 'Evento',
}
