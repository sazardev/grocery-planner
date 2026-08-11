/**
 * Modo 10-foot / TV (DESIGN §10.10): se activa cuando la pantalla no tiene
 * cursor (hover) ni toque — es decir, se maneja con control remoto (D-pad) —
 * y fuerza el modo oscuro (los salones suelen ser oscuros).
 *
 * Se puede forzar con `?tv=1` (o localStorage `gp-tv`) para probarlo en
 * cualquier pantalla.
 */

const TV_KEY = 'gp-tv'

export function detectTV(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  const noHover = !window.matchMedia('(hover: hover)').matches
  const noTouch = !('ontouchstart' in window)
  return noHover && noTouch
}

export function isTVForced(): boolean {
  try {
    const stored = localStorage.getItem(TV_KEY)
    if (stored === '1') return true
    if (stored === '0') return false
  } catch {
    /* sin almacenamiento */
  }
  if (typeof window !== 'undefined' && window.location.search.includes('tv=1')) return true
  return false
}

/** Aplica `data-mode="tv"` + modo oscuro si la pantalla es una TV. */
export function applyTVMode(): void {
  if (typeof document === 'undefined') return
  const forced = isTVForced()
  const isTV = forced || detectTV()
  const root = document.documentElement
  if (isTV) {
    root.dataset.mode = 'tv'
    root.dataset.theme = 'dark'
  } else {
    delete root.dataset.mode
  }
}
