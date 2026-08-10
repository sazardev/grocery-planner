import { useEffect, useState } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'gp-theme'
const VALID: ThemeMode[] = ['system', 'light', 'dark']

/** Preferencia de tema del dispositivo (sistema operativo / navegador). */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return 'light'
}

/** Resuelve el tema efectivo a partir del modo elegido. */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode
}

/** Lee el modo guardado (validado). */
export function loadThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && (VALID as string[]).includes(saved)) return saved as ThemeMode
  } catch {
    /* almacenamiento no disponible */
  }
  return 'system'
}

/** Guarda el modo elegido para que persista entre sesiones. */
export function saveThemeMode(mode: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* almacenamiento no disponible */
  }
}

/** Pinta el tema en <html data-theme="…"> (los tokens lo leen en tokens.css). */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolveTheme(mode)
}

/**
 * Tema con persistencia en localStorage.
 *
 * - `mode`: claro / oscuro / sistema (lo que eligió el usuario).
 * - En modo "sistema" se sigue en vivo el cambio de preferencia del dispositivo.
 */
export function useTheme(): { mode: ThemeMode; setMode: (m: ThemeMode) => void } {
  const [mode, setModeState] = useState<ThemeMode>(loadThemeMode)

  useEffect(() => {
    applyTheme(mode)
    saveThemeMode(mode)
  }, [mode])

  useEffect(() => {
    if (mode !== 'system' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [mode])

  const setMode = (next: ThemeMode) => setModeState(next)

  return { mode, setMode }
}
