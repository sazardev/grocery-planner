import type { PresenceView } from '../../domain/presence'
import { request } from './transport'

export function getPresence(): Promise<PresenceView[]> {
  return request<PresenceView[]>('presence_list')
}

export function presenceHeartbeat(name: string, screen?: string): Promise<PresenceView[]> {
  const args: Record<string, unknown> = { name }
  if (screen) args.screen = screen
  return request<PresenceView[]>('presence_heartbeat', args)
}

export function presenceLeave(name: string): Promise<PresenceView[]> {
  return request<PresenceView[]>('presence_leave', { name })
}
