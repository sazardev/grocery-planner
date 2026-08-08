import { request } from './transport'

/** Datos completos del hogar para respaldo (SPEC §15). */
export interface BackupData {
  exportedAt: string
  home?: {
    id: string
    name: string
    createdBy: string
    createdAt: string
    backupKey: string
    members: unknown[]
    invitations: unknown[]
  }
  items: unknown[]
  trips: unknown[]
  events: unknown[]
  plans: unknown[]
  sections: unknown[]
  chat: unknown[]
  rules: unknown
}

export function exportBackup(): Promise<BackupData> {
  return request<BackupData>('backup_export')
}

export function importBackup(data: BackupData): Promise<void> {
  return request<void>('backup_import', { data })
}
