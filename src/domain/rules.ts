export interface StoreConfig {
  name: string
  aisles: string[]
}

export interface NotificationSettings {
  onAssigned: boolean
  onUrgent: boolean
  onTripStarted: boolean
  onArrival: boolean
  onMention: boolean
  onEventReminder: boolean
  onProjection: boolean
  dailySummary: boolean
  weeklySummary: boolean
  silentFrom?: string
  silentTo?: string
  eventTypes: string[]
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  onAssigned: true,
  onUrgent: true,
  onTripStarted: true,
  onArrival: true,
  onMention: true,
  onEventReminder: true,
  onProjection: true,
  dailySummary: false,
  weeklySummary: false,
  silentFrom: undefined,
  silentTo: undefined,
  eventTypes: [],
}

export interface HomeRules {
  name: string
  stores: StoreConfig[]
  units: string[]
  categories: string[]
  photoLimit: number
  hostMode: boolean
  hostPauseWithVisitors: boolean
  privacyShowPhotos: boolean
  privacyShowPrices: boolean
  language: string
  timezone: string
  notifications: Record<string, NotificationSettings>
}

export const RULES_KEYS = ['rules'] as const
