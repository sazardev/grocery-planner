import type { TimelineEntry } from '../../domain/timeline'
import { request } from './transport'

/** Línea de tiempo de la familia entre dos días (AAAA-MM-DD, inclusivo). */
export function getTimeline(start: string, end: string): Promise<TimelineEntry[]> {
  return request<TimelineEntry[]>('timeline_get', { start, end })
}
