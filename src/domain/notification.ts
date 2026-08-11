export type NotificationKind =
  | 'assigned'
  | 'urgent'
  | 'trip_started'
  | 'arrival'
  | 'mention'
  | 'event_reminder'
  | 'projection'
  | 'daily_summary'
  | 'weekly_summary'

export interface AppNotification {
  id: string
  at: string
  kind: NotificationKind
  forMember: string
  title: string
  body: string
  read: boolean
  link?: string
}

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  assigned: 'Asignación',
  urgent: 'Urgente',
  trip_started: 'Mandado en curso',
  arrival: 'Llegó el mandado',
  mention: 'Mención',
  event_reminder: 'Evento',
  projection: 'Proyección',
  daily_summary: 'Resumen diario',
  weekly_summary: 'Resumen semanal',
}
