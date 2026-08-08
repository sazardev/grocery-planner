import type { Section } from '../../domain/section'
import { request } from './transport'

export function listSections(): Promise<Section[]> {
  return request<Section[]>('sections_list')
}

export function createSection(name: string): Promise<Section> {
  return request<Section>('section_create', { name })
}

export function renameSection(id: string, name: string): Promise<Section> {
  return request<Section>('section_rename', { id, name })
}

export function deleteSection(id: string): Promise<void> {
  return request<void>('section_delete', { id })
}

export type SectionMoveDirection = 'up' | 'down'

export function moveSection(id: string, direction: SectionMoveDirection): Promise<Section> {
  return request<Section>('section_move', { id, direction })
}
