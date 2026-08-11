/**
 * Claves de TanStack Query centralizadas.
 *
 * Una sola fuente de verdad para los queryKey de toda la app: así una mutación
 * en una página puede invalidar con exactitud lo que se ve en otras (lista,
 * calendario, reportes, avisos…) sin depender de cadenas duplicadas.
 *
 * Convención: un prefijo por "pantalla/dominio" y la misma query de datos
 * comparte clave donde conviene que invaliden juntas.
 */

// La lista de compras (HomePage) y "Lo mío" (MinePage) comparten el mismo
// dominio: cualquier cambio de estado/ítem refresca ambas.
export const items = (filters: readonly unknown[] = []) => ['items', ...filters]
export const item = (id: string) => ['item', id]
export const itemHistory = (id: string) => ['item', id, 'history']

export const trips = () => ['trips']
export const trip = (id: string) => ['trip', id]

export const plans = () => ['plans']
export const plan = (id: string) => ['plan', id]

export const events = () => ['events']
export const event = (id: string) => ['event', id]

export const calendarEvents = (start: string, end: string) => ['calendar', 'events', start, end]
export const calendarPlans = () => ['calendar', 'plans']
export const calendarTrips = () => ['calendar', 'trips']

export const timeline = (start: string, end: string) => ['timeline', start, end]

export const sections = () => ['sections']
export const rules = () => ['rules']
export const home = () => ['home']
export const sessions = () => ['sessions']

// Presencia: misma clave en cualquier pantalla (Home, Chat, Kiosk, Familia).
export const presence = () => ['presence']

// Proyección: la decisión en Home invalida el reporte y viceversa.
export const projection = () => ['projection']

export const notifications = () => ['notifications']
export const notificationUnread = () => ['notif-unread']
export const notificationMentions = () => ['notif-mentions']
export const familyNotifications = () => ['family', 'notifs']
export const notificationSettings = (member: string) => ['notif-settings', member]
export const hasPin = (member: string) => ['has-pin', member]

export const reportsTop = () => ['reports', 'top']
export const reportsSpending = () => ['reports', 'spending']
export const reportsTrips = () => ['reports', 'trips']

export const chatTail = () => ['chat-tail']
export const chatSearch = () => ['chat-search']

export const kioskItems = () => ['kiosk', 'items']

/** Invalida todo lo que puede cambiar con ítems (lista, mío, calendario…). */
export function itemsInvalidate() {
  return [
    { queryKey: items() },
    { queryKey: ['items'] },
  ]
}
