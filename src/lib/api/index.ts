import { request } from './transport'

export * from './auth'
export * from './backup'
export * from './chat'
export * from './events'
export * from './health'
export * from './home'
export * from './items'
export * from './plans'
export * from './presence'
export * from './reports'
export * from './rules'
export * from './sections'
export * from './timeline'
export * from './trips'

export interface AppInfo {
  name: string
  version: string
  dbReady: boolean
}

export async function getAppInfo(): Promise<AppInfo> {
  return request<AppInfo>('app_info')
}

export async function greet(name: string): Promise<string> {
  return request<string>('greet', { name })
}
