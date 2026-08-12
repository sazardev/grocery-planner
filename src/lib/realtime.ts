/**
 * Tiempo real (fase 2): sincronización por SSE entre dispositivos.
 *
 * El server HTTP publica un evento por dominio cuando una mutación responde
 * 2xx (`/api/events-stream`). Aquí nos suscribimos y, al recibir un evento,
 * invalidamos las consultas de TanStack Query de ese dominio para que la UI
 * refleje el cambio AL INSTANTE, sin esperar el polling de respaldo.
 *
 * Solo aplica en web/self-hosted (transport HTTP); en desktop (Tauri IPC) el
 * estado ya es local y las mutaciones invalidan por su cuenta.
 */
import type { QueryClient } from '@tanstack/react-query'
import { getAuthToken, triggerUnauthorized, webApiUrl } from './api/transport.ts'
import { IS_TAURI } from './platform.ts'

/** Qué prefijos de query invalida cada dominio que publica el server.
 *  Incluye `timeline`/`family` en los dominios que alimentan el historial
 *  (HistoryPage y el timeline de FamilyPage): si no, esas pantallas quedarían
 *  obsoletas hasta el polling de respaldo. */
const KIND_PREFIXES: Record<string, string[]> = {
  items: ['items', 'mine', 'kiosk', 'item', 'chat-pick', 'items-suggest', 'timeline', 'family'],
  chat: ['chat-tail', 'chat-search', 'item', 'timeline'],
  plans: ['plans', 'plan', 'calendar', 'family', 'timeline'],
  events: ['events', 'event', 'calendar', 'family', 'chat-pick', 'timeline'],
  trips: ['trips', 'trip', 'calendar', 'chat-pick', 'timeline', 'family'],
  home: ['home', 'family'],
  sections: ['sections'],
  rules: ['rules', 'host-mode'],
  notifications: ['notif-unread', 'notif-mentions', 'notifications', 'family'],
  reports: ['reports', 'projection'],
  timeline: ['timeline', 'family'],
}

function applyKind(queryClient: QueryClient, kind: string): void {
  if (kind === 'all') {
    queryClient.invalidateQueries()
    return
  }
  for (const prefix of KIND_PREFIXES[kind] ?? []) {
    queryClient.invalidateQueries({ queryKey: [prefix] })
  }
}

export interface RealtimeSync {
  /** Fuerza una reconexión inmediata (útil tras iniciar/cerrar sesión). */
  reconnect(): void
  /** Detiene la sincronización y libera la conexión. */
  stop(): void
}

/**
 * Inicia la suscripción SSE. Se llama una vez en el arranque; internamente
 * espera a que exista token (se conecta al iniciar sesión) y reconecta con
 * backoff si la conexión se cae. Devuelve `{ reconnect, stop }`.
 */
export function startRealtimeSync(queryClient: QueryClient): RealtimeSync {
  if (IS_TAURI) {
    // IPC local: nada que escuchar.
    return { reconnect: () => {}, stop: () => {} }
  }

  let controller: AbortController | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopped = false
  let lastToken: string | null = null

  const schedule = (delayMs: number) => {
    if (stopped) return
    timer = setTimeout(connect, delayMs)
  }

  const connect = async () => {
    if (stopped) return
    const token = getAuthToken()
    if (!token) {
      lastToken = null
      schedule(1500)
      return
    }
    if (token !== lastToken) {
      lastToken = token
      // El token cambió (login/logout): invalida lo de la sesión anterior.
      queryClient.invalidateQueries()
    }
    controller = new AbortController()
    const signal = controller.signal
    try {
      const res = await fetch(webApiUrl('/api/events-stream'), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      })
      if (res.status === 401) {
        // Token expirado/revocado: el stream no expira igual que una request
        // normal. Cierra la sesión en la UI (onUnauthorized limpia el token y
        // vuelve al login) en vez de quedarse reintentando cada 3 s.
        triggerUnauthorized()
        throw new Error('sse 401')
      }
      if (!res.ok || !res.body) throw new Error(`sse ${res.status}`)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (!stopped) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let sep: number
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const chunk = buffer.slice(0, sep)
          buffer = buffer.slice(sep + 2)
          const dataLine = chunk
            .split('\n')
            .find((l) => l.startsWith('data:'))
          if (!dataLine) continue
          try {
            const payload = JSON.parse(dataLine.slice(5).trim()) as { kind?: string }
            if (payload.kind) applyKind(queryClient, payload.kind)
          } catch {
            /* evento malformado: ignorar */
          }
        }
      }
    } catch {
      // Red caída, 401 o reinicio del server: reconectar con backoff.
    } finally {
      controller = null
      if (!stopped) schedule(3000)
    }
  }

  schedule(300)

  const handle: RealtimeSync = {
    reconnect() {
      controller?.abort()
      schedule(0)
    },
    stop() {
      stopped = true
      controller?.abort()
      if (timer) clearTimeout(timer)
      activeSync = null
    },
  }
  activeSync = handle
  return handle
}

/** Instancia activa (si la hay) para poder reconectarla desde AuthProvider. */
let activeSync: RealtimeSync | null = null

/** Fuerza una reconexión del stream SSE con el token de la sesión actual.
 *  Se invoca tras iniciar/cerrar sesión: el stream viejo queda ligado al token
 *  anterior y sin esto no se reiniciaría hasta caerse la conexión. */
export function realtimeReconnect(): void {
  activeSync?.reconnect()
}
