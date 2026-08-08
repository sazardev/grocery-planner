export type Role = 'miembro' | 'organizador' | 'admin'

export const ROLE_LABEL: Record<Role, string> = {
  miembro: 'Miembro',
  organizador: 'Organizador',
  admin: 'Admin',
}

export interface Member {
  name: string
  role: Role
  addedBy: string
  joinedAt: string
}

export interface Invitation {
  id: string
  token: string
  code: string
  roleGranted: Role
  expiresAt: string | null
  maxUses: number | null
  uses: number
  revoked: boolean
  createdBy: string
  createdAt: string
}

export interface HomeView {
  id: string
  name: string
  createdBy: string
  createdAt: string
  backupKey: string
  members: Member[]
  invitations: Invitation[]
}
