export interface User {
  id: string
  name: string
  alias: string | null
  avatar: string | null
  homeId: string | null
  createdAt: string
}

export interface AuthView {
  user: User
  token: string
}

export interface Session {
  token: string
  device: string
  createdAt: string
  lastUsedAt: string
  revoked: boolean
  current: boolean
  /** ISO UTC; la sesión se renueva al usarse (30 días de inactividad y caduca). */
  expiresAt?: string
}
