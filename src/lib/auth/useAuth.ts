import { createContext, useContext } from 'react'
import type { User } from '../../domain/auth'

export type AuthStatus = 'loading' | 'anonymous' | 'authenticated'

export interface AuthContextValue {
  status: AuthStatus
  user: User | null
  token: string | null
  signIn: (name: string, password: string) => Promise<void>
  signInWithPin: (name: string, pin: string) => Promise<void>
  signUp: (name: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  /** Entrada del quiosco con la llave del modo host (SPEC §2.3). */
  hostSignIn: (hostKey: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }
  return ctx
}
