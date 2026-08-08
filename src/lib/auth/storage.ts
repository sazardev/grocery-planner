import { setAuthToken } from '../api/transport'

/**
 * Persistencia del token de sesión. En desktop Tauri se guarda en el
 * localStorage del webview (fase 1); en fase 2 conviene moverlo a un
 * almacenamiento seguro del sistema (keyring) y añadir expiración.
 */
const TOKEN_KEY = 'grocery-planner.auth.token'

export function loadToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function saveToken(token: string | null): void {
  setAuthToken(token)
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // almacenamiento no disponible (modo privado): la sesión vive solo en memoria
  }
}

export function clearToken(): void {
  saveToken(null)
}
