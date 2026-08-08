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

export function setPin(name: string, pin: string): Promise<void> {
  return request<void>('auth_set_pin', { name, pin })
}

export function removePin(name: string): Promise<void> {
  return request<void>('auth_remove_pin', { name })
}

export function hasPin(name: string): Promise<boolean> {
  return request<boolean>('auth_has_pin', { name })
}

export function loginPin(name: string, pin: string, device: string): Promise<AuthView> {
  return request<AuthView>('auth_login_pin', { name, pin, device })
}
