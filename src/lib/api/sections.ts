import type { Section } from '../../domain/section'
import { request } from './transport'

export function listSections(): Promise<Section[]> {
  return request<Section[]>('sections_list')
}

export function createSection(name: string, by: string): Promise<Section> {
  return request<Section>('section_create', { name, by })
}

export function renameSection(id: string, name: string, by: string): Promise<Section> {
  return request<Section>('section_rename', { id, name, by })
}

export function deleteSection(id: string, by: string): Promise<void> {
  return request<void>('section_delete', { id, by })
}

export type SectionMoveDirection = 'up' | 'down'

export function moveSection(id: string, direction: SectionMoveDirection, by: string): Promise<Section> {
  return request<Section>('section_move', { id, direction, by })
}
