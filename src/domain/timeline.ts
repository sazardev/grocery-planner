export type TimelineKind =
  | 'item_created'
  | 'item_purchased'
  | 'item_cancelled'
  | 'item_commented'
  | 'item_assigned'
  | 'item_edited'
  | 'item_priority_changed'
  | 'item_price_changed'
  | 'item_section_changed'
  | 'item_store_changed'
  | 'item_photos_changed'
  | 'item_fallback_used'
  | 'item_deleted'
  | 'item_recovered'
  | 'trip_created'
  | 'trip_completed'
  | 'trip_received'
  | 'plan_created'
  | 'plan_completed'
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
  item_edited: 'Se editó',
  item_priority_changed: 'Prioridad',
  item_price_changed: 'Precio',
  item_section_changed: 'Sección',
  item_store_changed: 'Tienda',
  item_photos_changed: 'Fotos',
  item_fallback_used: 'Alternativa',
  item_deleted: 'Papelera',
  item_recovered: 'Recuperado',
  trip_created: 'Mandado',
  trip_completed: 'Mandado completado',
  trip_received: 'Llegó el mandado',
  plan_created: 'Plan',
  plan_completed: 'Plan cumplido',
  event_created: 'Evento',
}
