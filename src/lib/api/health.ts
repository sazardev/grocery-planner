import { request } from './transport'

export type HealthLevel = 'ok' | 'degraded' | 'down'

export interface HealthCheck {
  name: string
  level: HealthLevel
  message: string
}

export interface LiveInfo {
  status: HealthLevel
  uptimeSecs: number
}

export interface ReadyInfo {
  status: HealthLevel
  checks: HealthCheck[]
}

export interface HealthInfo {
  status: HealthLevel
  checks: HealthCheck[]
  version: string
  uptimeSecs: number
}

export function getLive(): Promise<LiveInfo> {
  return request<LiveInfo>('live')
}

export function getReady(): Promise<ReadyInfo> {
  return request<ReadyInfo>('ready')
}

export function getHealth(): Promise<HealthInfo> {
  return request<HealthInfo>('healthy')
}
