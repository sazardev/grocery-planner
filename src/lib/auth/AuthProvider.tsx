import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { login as apiLogin, loginPin as apiLoginPin, logout as apiLogout, me, registerAccount } from '../api'
import { onUnauthorized } from '../api/transport'
import { setMe } from '../me'
import { loadToken, clearToken, saveToken } from './storage'
import { AuthContext, type AuthContextValue, type AuthStatus } from './useAuth'

function deviceLabel(): string {
  const platform = typeof navigator !== 'undefined' ? navigator.platform : ''
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  if (/android/i.test(userAgent)) return 'Android'
  if (/iphone|ipad/i.test(userAgent)) return 'iOS'
  if (/linux/i.test(platform)) return 'Linux'
  if (/win/i.test(platform)) return 'Windows'
  if (/mac/i.test(platform)) return 'macOS'
  return 'dispositivo'
}

function applySession(token: string, user: AuthContextValue['user']): void {
  setMe(user?.name ?? null)
  saveToken(token)
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [token, setToken] = useState<AuthContextValue['token']>(null)

  // Al abrir la app: si hay token guardado, validarlo con `/auth/me`.
  useEffect(() => {
    let cancelled = false
    const stored = loadToken()
    if (!stored) {
      setStatus('anonymous')
      return
    }
    saveToken(stored)
    me(stored)
      .then((u) => {
        if (cancelled) return
        setUser(u)
        setToken(stored)
        setStatus('authenticated')
        setMe(u.name)
      })
      .catch(() => {
        if (cancelled) return
        clearToken()
        setUser(null)
        setToken(null)
        setStatus('anonymous')
        setMe(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Si cualquier petición responde 401 (sesión expirada/revocada), salir.
  useEffect(() => {
    onUnauthorized(() => {
      clearToken()
      setUser(null)
      setToken(null)
      setStatus('anonymous')
      setMe(null)
    })
    return () => onUnauthorized(null)
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    async function signIn(name: string, password: string): Promise<void> {
      const view = await apiLogin(name, password, deviceLabel())
      applySession(view.token, view.user)
      setUser(view.user)
      setToken(view.token)
      setStatus('authenticated')
    }

    async function signInWithPin(name: string, pin: string): Promise<void> {
      const view = await apiLoginPin(name, pin, deviceLabel())
      applySession(view.token, view.user)
      setUser(view.user)
      setToken(view.token)
      setStatus('authenticated')
    }

    async function signUp(name: string, password: string): Promise<void> {
      const view = await registerAccount(name, password)
      applySession(view.token, view.user)
      setUser(view.user)
      setToken(view.token)
      setStatus('authenticated')
    }

    async function signOut(): Promise<void> {
      if (token) {
        apiLogout(token).catch(() => {
          /* la sesión ya no es válida; limpiamos igual */
        })
      }
      clearToken()
      setUser(null)
      setToken(null)
      setStatus('anonymous')
      setMe(null)
    }

    return { status, user, token, signIn, signInWithPin, signUp, signOut }
  }, [status, user, token])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
