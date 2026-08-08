import type {
  MemberTripCount,
  Projection,
  SpendingReport,
  TopProduct,
} from '../../domain/report'
import { request } from './transport'

export function getTopProducts(): Promise<TopProduct[]> {
  return request<TopProduct[]>('reports_top_products')
}

export function getSpending(): Promise<SpendingReport> {
  return request<SpendingReport>('reports_spending')
}

export function getTripsByMember(): Promise<MemberTripCount[]> {
  return request<MemberTripCount[]>('reports_trips_by_member')
}

export function getProjection(): Promise<Projection[]> {
  return request<Projection[]>('reports_projection')
}

/** Confirmar o descartar una sugerencia de proyección (SPEC §7.2). */
export function decideProjection(name: string, confirmed: boolean): Promise<boolean> {
  return request<boolean>('projection_decide', { name, confirmed })
}
