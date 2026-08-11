import { useEffect } from 'react'
import { presenceLeave } from '../api/presence.ts'

/**
 * Avísale al backend cuando esta pestaña/dispositivo se cierra o se navega a
 * otro lado, para que la presencia marque "desconectado" al instante en vez de
 * esperar la poda de ~30 s (evita los "fantasmas" en línea).
 */
export function usePresenceLeave(name: string): void {
  useEffect(() => {
    if (!name) return
    let sent = false
    const send = () => {
      if (sent) return
      sent = true
      // best-effort: en pagehide fire-and-forget (fetch sobrevive al unload).
      void presenceLeave(name)
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') send()
    }
    window.addEventListener('pagehide', send)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      send()
      window.removeEventListener('pagehide', send)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [name])
}
