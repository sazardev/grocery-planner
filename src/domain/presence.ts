export interface PresenceView {
  name: string
  online: boolean
  lastSeen: string
  /** Pantalla en la que está el miembro (ej. "chat", "lista"); undefined = sin declarar. */
  screen?: string | null
}
