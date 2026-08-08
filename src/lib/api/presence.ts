import type { PresenceView } from '../../domain/presence'
import { request } from './transport'

export function getPresence(): Promise<PresenceView[]> {
  return request<PresenceView[]>('presence_list')
}

export function presenceHeartbeat(name: string): Promise<PresenceView[]> {
  return request<PresenceView[]>('presence_heartbeat', { name })
}

export function presenceLeave(name: string): Promise<PresenceView[]> {
  return request<PresenceView[]>('presence_leave', { name })
}
