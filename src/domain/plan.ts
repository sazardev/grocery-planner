export type Recurrence = 'ninguna' | 'semanal' | 'quincenal' | 'mensual'

export type PlanStatus = 'planificado' | 'activo' | 'completado' | 'cancelado'

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  ninguna: 'Una vez',
  semanal: 'Cada semana',
  quincenal: 'Cada quincena',
  mensual: 'Cada mes',
}

export interface Plan {
  id: string
  title: string
  scheduledAt: string
  store?: string
  assignedTo?: string
  note?: string
  recurrence: Recurrence
  createdBy: string
  createdAt: string
  status: PlanStatus
}
