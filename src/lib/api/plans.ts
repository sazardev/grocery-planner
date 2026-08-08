import type { Plan, Recurrence } from '../../domain/plan'
import { request } from './transport'

export interface CreatePlanInput {
  title: string
  scheduledAt: string
  store?: string
  assignedTo?: string
  note?: string
  recurrence?: Recurrence
  createdBy: string
}

export function listPlans(): Promise<Plan[]> {
  return request<Plan[]>('plans_list')
}

export function createPlan(input: CreatePlanInput): Promise<Plan> {
  return request<Plan>('plan_create', {
    title: input.title,
    scheduledAt: input.scheduledAt,
    store: input.store ?? null,
    assignedTo: input.assignedTo ?? null,
    note: input.note ?? null,
    recurrence: input.recurrence ?? 'ninguna',
    createdBy: input.createdBy,
  })
}

export function getPlan(id: string): Promise<Plan> {
  return request<Plan>('plan_get', { id })
}

export function activatePlan(id: string): Promise<Plan> {
  return request<Plan>('plan_activate', { id })
}

export function completePlan(id: string): Promise<Plan> {
  return request<Plan>('plan_complete', { id })
}

export function cancelPlan(id: string): Promise<Plan> {
  return request<Plan>('plan_cancel', { id })
}
