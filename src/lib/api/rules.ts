import type { AppNotification } from '../../domain/notification'
import type { HomeRules, NotificationSettings } from '../../domain/rules'
import { request } from './transport'

export interface UpdateRulesInput {
  name?: string
  units?: string[]
  categories?: string[]
  photoLimit?: number
  hostMode?: boolean
  hostPauseWithVisitors?: boolean
  privacyShowPhotos?: boolean
  privacyShowPrices?: boolean
  language?: string
  timezone?: string
}

export function getRules(): Promise<HomeRules> {
  return request<HomeRules>('rules_get')
}

export function updateRules(input: UpdateRulesInput, by: string): Promise<HomeRules> {
  return request<HomeRules>('rules_update', {
    by,
    name: input.name ?? null,
    units: input.units ?? null,
    categories: input.categories ?? null,
    photoLimit: input.photoLimit ?? null,
    hostMode: input.hostMode ?? null,
    hostPauseWithVisitors: input.hostPauseWithVisitors ?? null,
    privacyShowPhotos: input.privacyShowPhotos ?? null,
    privacyShowPrices: input.privacyShowPrices ?? null,
    language: input.language ?? null,
    timezone: input.timezone ?? null,
  })
}

export function addStore(name: string, aisles: string[] = [], by: string): Promise<HomeRules> {
  return request<HomeRules>('rules_store_add', { name, aisles, by })
}

export function renameStore(name: string, newName: string, by: string): Promise<HomeRules> {
  return request<HomeRules>('rules_store_rename', { name, newName, by })
}

export function removeStore(name: string, by: string): Promise<HomeRules> {
  return request<HomeRules>('rules_store_remove', { name, by })
}

export function addAisle(storeName: string, aisle: string, by: string): Promise<HomeRules> {
  return request<HomeRules>('rules_aisle_add', { storeName, aisle, by })
}

export function removeAisle(storeName: string, aisle: string, by: string): Promise<HomeRules> {
  return request<HomeRules>('rules_aisle_remove', { storeName, aisle, by })
}

// ----- Notificaciones (SPEC §13) ------------------------------------------

export function listNotifications(member: string): Promise<AppNotification[]> {
  return request<AppNotification[]>('notifications_list', { member })
}

export function getUnreadNotifications(member: string): Promise<number> {
  return request<number>('notifications_unread_count', { member })
}

export function markNotificationRead(id: string, member: string): Promise<void> {
  return request<void>('notifications_mark_read', { id, member })
}

export function markAllNotificationsRead(member: string): Promise<void> {
  return request<void>('notifications_mark_all_read', { member })
}

export function getUnreadMentions(member: string): Promise<number> {
  return request<number>('notifications_mentions_unread_count', { member })
}

export function markMentionsRead(member: string): Promise<void> {
  return request<void>('notifications_mentions_mark_read', { member })
}

export function getNotificationSettings(member: string): Promise<NotificationSettings> {
  return request<NotificationSettings>('notifications_settings_get', { member })
}

export function updateNotificationSettings(
  member: string,
  settings: NotificationSettings,
): Promise<NotificationSettings> {
  return request<NotificationSettings>('notifications_settings_update', { member, settings })
}
