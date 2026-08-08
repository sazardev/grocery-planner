export type TripStatus = 'planificada' | 'activa' | 'completada' | 'cancelada'

export interface ShoppingTrip {
  id: string
  title: string
  store?: string
  assignedTo?: string
  createdBy: string
  createdAt: string
  status: TripStatus
  itemIds: string[]
  /** Cuándo alguien de la casa confirmó que llegó el mandado (SPEC §6). */
  receivedAt?: string
  /** Quién confirmó la recepción. */
  receivedBy?: string
}
