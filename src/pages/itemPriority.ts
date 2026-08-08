import type { Priority } from '../domain/item'
import type { ChipTone } from '../shared/ui/primitives/Chip.tsx'

export const PRIORITY_LABEL: Record<Priority, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  urgente: 'Urgente',
}

export const PRIORITY_TONE: Record<Priority, ChipTone> = {
  baja: 'muted',
  media: 'default',
  alta: 'info',
  urgente: 'warning',
}
