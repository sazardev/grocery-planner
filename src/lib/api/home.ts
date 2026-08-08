import type { HomeView, Invitation, Member, Role } from '../../domain/home'
import { request } from './transport'

export function createHome(name: string, owner: string): Promise<HomeView> {
  return request<HomeView>('home_create', { name, owner })
}

export function getHome(): Promise<HomeView> {
  return request<HomeView>('home_info')
}

export function addHomeMember(name: string, role: Role, by: string): Promise<Member> {
  return request<Member>('home_add_member', { name, role, by })
}

export function removeHomeMember(name: string, by: string): Promise<void> {
  return request<void>('home_remove_member', { name, by })
}

export function changeHomeRole(name: string, role: Role, by: string): Promise<Member> {
  return request<Member>('home_change_role', { name, role, by })
}

export interface CreateInvitationInput {
  by: string
  roleGranted: Role
  expiresInSecs?: number
  maxUses?: number
}

export function createInvitation(input: CreateInvitationInput): Promise<Invitation> {
  return request<Invitation>('home_invite_create', {
    by: input.by,
    roleGranted: input.roleGranted,
    expiresInSecs: input.expiresInSecs ?? null,
    maxUses: input.maxUses ?? null,
  })
}

export function revokeInvitation(id: string, by: string): Promise<Invitation> {
  return request<Invitation>('home_invite_revoke', { id, by })
}

export function acceptInvitation(code: string, member: string): Promise<Member> {
  return request<Member>('home_invite_accept', { code, member })
}

export function regenerateBackupKey(by: string): Promise<string> {
  return request<string>('home_backup_key_regenerate', { by })
}
