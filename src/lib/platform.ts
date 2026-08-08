export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function platform(): 'desktop' | 'mobile' | 'web' {
  if (!isTauri()) return 'web'
  const ua = navigator.userAgent
  return /android|iphone|ipad/i.test(ua) ? 'mobile' : 'desktop'
}

export const IS_TAURI = isTauri()
export const PLATFORM = platform()
