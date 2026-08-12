import type { AuthView, Session, User } from '../../domain/auth'
import { request } from './transport'

export function registerAccount(name: string, password: string): Promise<AuthView> {
  return request<AuthView>('auth_register', { name, password })
}

export function login(name: string, password: string, device: string): Promise<AuthView> {
  return request<AuthView>('auth_login', { name, password, device })
}

export function logout(token: string): Promise<void> {
  return request<void>('auth_logout', { token })
}

export function me(token: string): Promise<User> {
  return request<User>('auth_me', { token })
}

export function listSessions(token: string): Promise<Session[]> {
  return request<Session[]>('auth_sessions', { token })
}

export function revokeSession(token: string, targetToken: string): Promise<boolean> {
  return request<boolean>('auth_revoke_session', { token, targetToken })
}

export function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return request<void>('auth_change_password', { token, currentPassword, newPassword })
}

/** Actualiza alias y avatar de la cuenta (SPEC §2.1). `undefined` = no tocar. */
export function updateProfile(
  token: string,
  alias?: string,
  avatar?: string,
): Promise<User> {
  return request<User>('auth_update_profile', { token, alias: alias ?? null, avatar: avatar ?? null })
}

/** Restablece la contraseña de un miembro con la clave de respaldo (SPEC §2.5).
 * No requiere sesión: funciona aunque hayas perdido la contraseña. */
export function resetPassword(
  name: string,
  backupKey: string,
  newPassword: string,
): Promise<void> {
  return request<void>('auth_reset_password', { name, backupKey, newPassword })
}

/** Regenera la contraseña de un miembro sin clave de respaldo (SPEC §2.5):
 * la hace un Organizador/Admin. */
export function adminResetPassword(
  name: string,
  newPassword: string,
  by: string,
): Promise<void> {
  return request<void>('auth_admin_reset_password', { name, newPassword, by })
}

export function setPin(name: string, pin: string, by: string): Promise<void> {
  return request<void>('auth_set_pin', { name, pin, by })
}

export function removePin(name: string, by: string): Promise<void> {
  return request<void>('auth_remove_pin', { name, by })
}

export function hasPin(name: string): Promise<boolean> {
  return request<boolean>('auth_has_pin', { name })
}

export function loginPin(name: string, pin: string, device: string): Promise<AuthView> {
  return request<AuthView>('auth_login_pin', { name, pin, device })
}

/** Entrada del modo host del quiosco (SPEC §2.3): llave del hogar, sin credenciales. */
export function hostLogin(hostKey: string, device: string): Promise<AuthView> {
  return request<AuthView>('auth_host_login', { hostKey, device })
}
