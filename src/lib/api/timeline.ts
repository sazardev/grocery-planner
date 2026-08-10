import type { TimelineEntry } from '../../domain/timeline'
import { request } from './transport'

/** Línea de tiempo de la familia entre dos marcas ISO RFC3339 (inclusivo). */
export function getTimeline(start: string, end: string): Promise<TimelineEntry[]> {
  return request<TimelineEntry[]>('timeline_get', { start, end })
}
