/**
 * Capa de acceso a datos (abstracción de transporte).
 *
 * - Desktop / Mobile: llama al backend Rust vía IPC de Tauri (invoke).
 * - Web: llama al servidor HTTP self-hosted (Rust + axum).
 *
 * URL del backend web configurable con `VITE_API_URL` (default localhost:8787).
 */
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { IS_TAURI } from '../platform'

export type Transport = 'tauri' | 'http'

export function currentTransport(): Transport {
  return IS_TAURI ? 'tauri' : 'http'
}

const API_BASE_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

type Route = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT'
  path: (args: Record<string, unknown>) => string
  body?: (args: Record<string, unknown>) => Record<string, unknown>
}

function pick(obj: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of keys) if (k in obj) out[k] = obj[k]
  return out
}

const ROUTES: Record<string, Route> = {
  live: { method: 'GET', path: () => '/health/live' },
  ready: { method: 'GET', path: () => '/health/ready' },
  healthy: { method: 'GET', path: () => '/health/healthy' },
  app_info: { method: 'GET', path: () => '/api/app-info' },
  greet: {
    method: 'POST',
    path: () => '/api/greet',
    body: (a) => pick(a, ['name']),
  },
  auth_register: {
    method: 'POST',
    path: () => '/api/auth/register',
    body: (a) => pick(a, ['name', 'password']),
  },
  auth_login: {
    method: 'POST',
    path: () => '/api/auth/login',
    body: (a) => pick(a, ['name', 'password', 'device']),
  },
  auth_logout: { method: 'POST', path: () => '/api/auth/logout' },
  auth_me: { method: 'GET', path: () => '/api/auth/me' },
  auth_sessions: { method: 'GET', path: () => '/api/auth/sessions' },
  auth_revoke_session: {
    method: 'POST',
    path: () => '/api/auth/sessions/revoke',
    body: (a) => pick(a, ['targetToken']),
  },
  auth_change_password: {
    method: 'POST',
    path: () => '/api/auth/password',
    body: (a) => pick(a, ['currentPassword', 'newPassword']),
  },
  auth_set_pin: {
    method: 'POST',
    path: () => '/api/auth/pin',
    body: (a) => pick(a, ['name', 'pin']),
  },
  auth_remove_pin: {
    method: 'DELETE',
    path: () => '/api/auth/pin',
    body: (a) => pick(a, ['name', 'pin']),
  },
  auth_has_pin: {
    method: 'GET',
    path: (a) => `/api/auth/has-pin?name=${encodeURIComponent(String(a['name'] ?? ''))}`,
  },
  auth_login_pin: {
    method: 'POST',
    path: () => '/api/auth/login-pin',
    body: (a) => pick(a, ['name', 'pin', 'device']),
  },
  chat_list: { method: 'GET', path: () => '/api/chat' },
  chat_page: {
    method: 'GET',
    path: (a) => {
      const p = new URLSearchParams()
      if (a['limit'] != null) p.set('limit', String(a['limit']))
      if (a['before']) p.set('before', String(a['before']))
      const qs = p.toString()
      return `/api/chat/page${qs ? `?${qs}` : ''}`
    },
  },
  chat_search: {
    method: 'GET',
    path: (a) => {
      const p = new URLSearchParams()
      if (a['query']) p.set('query', String(a['query']))
      if (a['by']) p.set('by', String(a['by']))
      if (a['refKind']) p.set('refKind', String(a['refKind']))
      if (a['hasPhoto'] != null) p.set('hasPhoto', String(a['hasPhoto']))
      if (a['limit'] != null) p.set('limit', String(a['limit']))
      const qs = p.toString()
      return `/api/chat/search${qs ? `?${qs}` : ''}`
    },
  },
  chat_count: { method: 'GET', path: () => '/api/chat/count' },
  chat_send: {
    method: 'POST',
    path: () => '/api/chat',
    body: (a) => pick(a, ['by', 'body', 'photo', 'itemId', 'refs']),
  },
  chat_react: {
    method: 'POST',
    path: (a) => `/api/chat/${a['id']}/react`,
    body: (a) => pick(a, ['emoji', 'by']),
  },
  chat_pin: { method: 'POST', path: (a) => `/api/chat/${a['id']}/pin` },
  rules_get: { method: 'GET', path: () => '/api/rules' },
  rules_update: {
    method: 'PATCH',
    path: () => '/api/rules',
    body: (a) =>
      pick(a, [
        'name',
        'units',
        'categories',
        'photoLimit',
        'hostMode',
        'hostPauseWithVisitors',
        'privacyShowPhotos',
        'privacyShowPrices',
        'language',
        'timezone',
      ]),
  },
  rules_store_add: {
    method: 'POST',
    path: () => '/api/rules/stores',
    body: (a) => pick(a, ['name', 'aisles']),
  },
  rules_store_rename: {
    method: 'PATCH',
    path: (a) => `/api/rules/stores/${a['name']}`,
    body: (a) => pick(a, ['newName']),
  },
  rules_store_remove: {
    method: 'DELETE',
    path: (a) => `/api/rules/stores/${a['name']}`,
  },
  rules_aisle_add: {
    method: 'POST',
    path: (a) => `/api/rules/stores/${a['storeName']}/aisles`,
    body: (a) => pick(a, ['aisle']),
  },
  rules_aisle_remove: {
    method: 'DELETE',
    path: (a) => `/api/rules/stores/${a['storeName']}/aisles/${a['aisle']}`,
  },
  notifications_list: {
    method: 'GET',
    path: (a) => `/api/notifications?member=${encodeURIComponent(String(a['member'] ?? ''))}`,
  },
  notifications_unread_count: {
    method: 'GET',
    path: (a) => `/api/notifications/unread?member=${encodeURIComponent(String(a['member'] ?? ''))}`,
  },
  notifications_mark_read: {
    method: 'POST',
    path: (a) => `/api/notifications/${a['id']}/read`,
    body: (a) => pick(a, ['member']),
  },
  notifications_mark_all_read: {
    method: 'POST',
    path: () => '/api/notifications/read-all',
    body: (a) => pick(a, ['member']),
  },
  notifications_mentions_unread_count: {
    method: 'GET',
    path: (a) => `/api/notifications/mentions/unread?member=${encodeURIComponent(String(a['member'] ?? ''))}`,
  },
  notifications_mentions_mark_read: {
    method: 'POST',
    path: () => '/api/notifications/mentions/read',
    body: (a) => pick(a, ['member']),
  },
  notifications_settings_get: {
    method: 'GET',
    path: (a) => `/api/notifications/settings?member=${encodeURIComponent(String(a['member'] ?? ''))}`,
  },
  notifications_settings_update: {
    method: 'PUT',
    path: () => '/api/notifications/settings',
    body: (a) => pick(a, ['member', 'settings']),
  },
  projection_decide: {
    method: 'POST',
    path: () => '/api/reports/projection/decide',
    body: (a) => pick(a, ['name', 'confirmed']),
  },
  timeline_get: {
    method: 'GET',
    path: (a) => `/api/timeline?start=${encodeURIComponent(String(a['start']))}&end=${encodeURIComponent(String(a['end']))}`,
  },
  backup_export: { method: 'GET', path: () => '/api/backup' },
  backup_import: {
    method: 'POST',
    path: () => '/api/backup/import',
    body: (a) => pick(a, ['data']),
  },
  items_list: { method: 'GET', path: () => '/api/items' },
  item_get: { method: 'GET', path: (a) => `/api/items/${a['id']}` },
  item_history: { method: 'GET', path: (a) => `/api/items/${a['id']}/history` },
  item_create: {
    method: 'POST',
    path: () => '/api/items',
    body: (a) => pick(a, ['name', 'quantity', 'unit', 'priority', 'requestedBy', 'note', 'category', 'price', 'section', 'brand', 'quantityMax', 'fallbacks']),
  },
  items_query: {
    method: 'POST',
    path: () => '/api/items/query',
    body: (a) => pick(a, ['search', 'status', 'category', 'priority', 'section', 'requestedBy', 'assignedTo', 'store', 'urgent', 'onlyComments', 'onlyPhotos', 'sort']),
  },
  item_add_comment: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/comment`,
    body: (a) => pick(a, ['by', 'body']),
  },
  item_set_price: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}/price`,
    body: (a) => pick(a, ['price']),
  },
  item_set_section: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}/section`,
    body: (a) => pick(a, ['section']),
  },
  item_set_store: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}/store`,
    body: (a) => pick(a, ['storeName']),
  },
  item_set_brand: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}/brand`,
    body: (a) => pick(a, ['brand', 'by']),
  },
  item_set_quantity_max: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}/quantity-max`,
    body: (a) => pick(a, ['max', 'by']),
  },
  item_add_fallback: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/fallbacks`,
    body: (a) => pick(a, ['name', 'quantity', 'unit', 'note', 'by']),
  },
  item_remove_fallback: {
    method: 'DELETE',
    path: (a) => `/api/items/${a['id']}/fallbacks/${a['index']}`,
    body: (a) => pick(a, ['by']),
  },
  item_use_fallback: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/fallbacks/${a['index']}/use`,
    body: (a) => pick(a, ['by']),
  },
  item_add_photo: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/photos`,
    body: (a) => pick(a, ['photo']),
  },
  item_remove_photo: {
    method: 'DELETE',
    path: (a) => `/api/items/${a['id']}/photos/${a['index']}`,
  },
  item_recover: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/recover`,
    body: (a) => pick(a, ['by']),
  },
  items_purchased_between: {
    method: 'GET',
    path: (a) => `/api/items/purchased?start=${encodeURIComponent(String(a['start']))}&end=${encodeURIComponent(String(a['end']))}`,
  },
  item_update: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}`,
    body: (a) => pick(a, ['by', 'name', 'quantity', 'unit', 'priority', 'note', 'category']),
  },
  item_set_priority: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}/priority`,
    body: (a) => pick(a, ['priority', 'by']),
  },
  item_move: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/move`,
    body: (a) => pick(a, ['direction']),
  },
  item_delete: { method: 'DELETE', path: (a) => `/api/items/${a['id']}` },
  item_change_status: {
    method: 'PATCH',
    path: (a) => `/api/items/${a['id']}/status`,
    body: (a) => pick(a, ['to', 'by']),
  },
  item_assign: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/assign`,
    body: (a) => pick(a, ['member', 'by']),
  },
  item_unassign: {
    method: 'DELETE',
    path: (a) => `/api/items/${a['id']}/assign`,
    body: (a) => pick(a, ['by']),
  },
  item_cancel: {
    method: 'POST',
    path: (a) => `/api/items/${a['id']}/cancel`,
    body: (a) => pick(a, ['by', 'reason']),
  },
  item_flows: { method: 'GET', path: () => '/api/item-flows' },
  item_transition: {
    method: 'POST',
    path: () => '/api/items/transition',
    body: (a) => pick(a, ['from', 'to']),
  },
  parse_quick_entry: {
    method: 'POST',
    path: () => '/api/parse-quick-entry',
    body: (a) => pick(a, ['text']),
  },
  validate_new_item: {
    method: 'POST',
    path: () => '/api/items/validate',
    body: (a) => pick(a, ['name', 'quantity', 'unit']),
  },
  presence_list: { method: 'GET', path: () => '/api/presence' },
  presence_heartbeat: {
    method: 'POST',
    path: () => '/api/presence/heartbeat',
    body: (a) => pick(a, ['name', 'screen']),
  },
  presence_leave: {
    method: 'POST',
    path: () => '/api/presence/leave',
    body: (a) => pick(a, ['name']),
  },
  trips_list: { method: 'GET', path: () => '/api/trips' },
  trips_get: { method: 'GET', path: (a) => `/api/trips/${a['id']}` },
  trips_create: {
    method: 'POST',
    path: () => '/api/trips',
    body: (a) => pick(a, ['title', 'store', 'assignedTo', 'by']),
  },
  trips_add_item: {
    method: 'POST',
    path: (a) => `/api/trips/${a['id']}/items/add`,
    body: (a) => pick(a, ['itemId']),
  },
  trips_remove_item: {
    method: 'POST',
    path: (a) => `/api/trips/${a['id']}/items/remove`,
    body: (a) => pick(a, ['itemId']),
  },
  trips_assign: {
    method: 'POST',
    path: (a) => `/api/trips/${a['id']}/assign`,
    body: (a) => pick(a, ['member']),
  },
  trips_activate: { method: 'POST', path: (a) => `/api/trips/${a['id']}/activate` },
  trips_complete: { method: 'POST', path: (a) => `/api/trips/${a['id']}/complete` },
  trips_cancel: { method: 'POST', path: (a) => `/api/trips/${a['id']}/cancel` },
  trips_confirm_received: {
    method: 'POST',
    path: (a) => `/api/trips/${a['id']}/received`,
    body: (a) => pick(a, ['by']),
  },
  home_create: {
    method: 'POST',
    path: () => '/api/home',
    body: (a) => pick(a, ['name', 'owner']),
  },
  home_info: { method: 'GET', path: () => '/api/home' },
  home_add_member: {
    method: 'POST',
    path: () => '/api/home/members',
    body: (a) => pick(a, ['name', 'role', 'by']),
  },
  home_remove_member: {
    method: 'DELETE',
    path: (a) => `/api/home/members/${a['name']}`,
    body: (a) => pick(a, ['by']),
  },
  home_change_role: {
    method: 'PATCH',
    path: () => '/api/home/roles',
    body: (a) => pick(a, ['name', 'role', 'by']),
  },
  home_invite_create: {
    method: 'POST',
    path: () => '/api/home/invitations',
    body: (a) => pick(a, ['by', 'roleGranted', 'expiresInSecs', 'maxUses']),
  },
  home_invite_revoke: {
    method: 'POST',
    path: (a) => `/api/home/invitations/${a['id']}/revoke`,
    body: (a) => pick(a, ['by']),
  },
  home_invite_accept: {
    method: 'POST',
    path: () => '/api/home/invitations/accept',
    body: (a) => pick(a, ['code', 'member']),
  },
  home_backup_key_regenerate: {
    method: 'POST',
    path: () => '/api/home/backup-key',
    body: (a) => pick(a, ['by']),
  },
  events_list: { method: 'GET', path: () => '/api/events' },
  events_list_range: {
    method: 'GET',
    path: (a) => `/api/events/range?start=${a['start']}&end=${a['end']}`,
  },
  event_create: {
    method: 'POST',
    path: () => '/api/events',
    body: (a) => pick(a, ['title', 'date', 'time', 'allDay', 'kind', 'place', 'participants', 'note', 'recurringYearly', 'createdBy']),
  },
  event_get: { method: 'GET', path: (a) => `/api/events/${a['id']}` },
  event_delete: { method: 'DELETE', path: (a) => `/api/events/${a['id']}` },
  event_add_item: {
    method: 'POST',
    path: (a) => `/api/events/${a['id']}/items/add`,
    body: (a) => pick(a, ['itemId']),
  },
  event_remove_item: {
    method: 'POST',
    path: (a) => `/api/events/${a['id']}/items/remove`,
    body: (a) => pick(a, ['itemId']),
  },
  plans_list: { method: 'GET', path: () => '/api/plans' },
  plan_create: {
    method: 'POST',
    path: () => '/api/plans',
    body: (a) => pick(a, ['title', 'scheduledAt', 'store', 'assignedTo', 'note', 'recurrence', 'createdBy']),
  },
  plan_get: { method: 'GET', path: (a) => `/api/plans/${a['id']}` },
  plan_activate: { method: 'POST', path: (a) => `/api/plans/${a['id']}/activate` },
  plan_complete: { method: 'POST', path: (a) => `/api/plans/${a['id']}/complete` },
  plan_cancel: { method: 'POST', path: (a) => `/api/plans/${a['id']}/cancel` },
  sections_list: { method: 'GET', path: () => '/api/sections' },
  section_create: {
    method: 'POST',
    path: () => '/api/sections',
    body: (a) => pick(a, ['name']),
  },
  section_rename: {
    method: 'PATCH',
    path: (a) => `/api/sections/${a['id']}`,
    body: (a) => pick(a, ['name']),
  },
  section_delete: { method: 'DELETE', path: (a) => `/api/sections/${a['id']}` },
  section_move: {
    method: 'POST',
    path: (a) => `/api/sections/${a['id']}/move`,
    body: (a) => pick(a, ['direction']),
  },
  reports_top_products: { method: 'GET', path: () => '/api/reports/top-products' },
  reports_spending: { method: 'GET', path: () => '/api/reports/spending' },
  reports_trips_by_member: { method: 'GET', path: () => '/api/reports/trips-by-member' },
  reports_projection: { method: 'GET', path: () => '/api/reports/projection' },
}

export class ApiError extends Error {
  type: string
  status: number

  constructor(type: string, message: string, status: number) {
    super(message)
    this.type = type
    this.status = status
  }
}

// Token de sesión para el transporte web (header `Authorization: Bearer`).
// En desktop se pasa por argumento a los commands; aquí solo aplica a HTTP.
let authToken: string | null = null
let unauthorizedHandler: (() => void) | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function getAuthToken(): string | null {
  return authToken
}

/** Registra un handler global que se llama ante un 401 (sesión expirada/revocada). */
export function onUnauthorized(handler: (() => void) | null): void {
  unauthorizedHandler = handler
}

function normalizeTauriError(err: unknown): ApiError {
  const msg =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : JSON.stringify(err)
  try {
    const parsed = JSON.parse(msg) as { type?: string; message?: string }
    if (parsed.type && parsed.message) {
      return new ApiError(parsed.type, parsed.message, 0)
    }
  } catch {
    // no es JSON; lo dejamos pasar
  }
  return new ApiError('internal', msg, 0)
}

export async function request<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (IS_TAURI) {
    try {
      return await tauriInvoke<T>(command, args)
    } catch (err) {
      throw normalizeTauriError(err)
    }
  }

  const route = ROUTES[command]
  if (!route) {
    throw new ApiError('notFound', `Comando HTTP no registrado: ${command}`, 404)
  }

  const init: RequestInit = { method: route.method }
  const headers: Record<string, string> = {}
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  if (route.body) headers['Content-Type'] = 'application/json'
  if (Object.keys(headers).length > 0) init.headers = headers
  if (route.body) init.body = JSON.stringify(route.body(args))

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${route.path(args)}`, init)
  } catch {
    throw new ApiError(
      'internal',
      `No se pudo conectar con el servidor de la casa (${API_BASE_URL}). Asegúrate de que esté encendido y vuelve a intentar.`,
      0,
    )
  }

  if (!res.ok) {
    let type = 'internal'
    let message = `Error ${res.status}`
    try {
      const body = (await res.json()) as { type?: string; message?: string }
      type = body.type ?? type
      message = body.message ?? message
    } catch {
      // sin cuerpo JSON; usamos el mensaje por defecto
    }
    if (res.status === 401) {
      unauthorizedHandler?.()
      type = 'unauthorized'
      message = message || 'Tu sesión expiró; vuelve a iniciar sesión.'
    }
    throw new ApiError(type, message, res.status)
  }

  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}
