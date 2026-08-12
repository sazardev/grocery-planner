import type {
  MemberTripCount,
  Projection,
  SpendingReport,
  TopProduct,
} from '../../domain/report'
import { ME } from '../me'
import { request } from './transport'

/** Ventanas de tiempo de los reportes (SPEC §8.2). `''` = todo el historial. */
export type ReportWindow = '' | 'hoy' | '7d' | '30d' | 'semana' | 'mes' | 'anio'

export const REPORT_WINDOW_LABEL: Record<Exclude<ReportWindow, ''>, string> = {
  hoy: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  semana: 'Esta semana',
  mes: 'Este mes',
  anio: 'Este año',
}

export function getTopProducts(window: ReportWindow = ''): Promise<TopProduct[]> {
  return request<TopProduct[]>('reports_top_products', window ? { window } : {})
}

export function getSpending(window: ReportWindow = ''): Promise<SpendingReport> {
  return request<SpendingReport>('reports_spending', window ? { window } : {})
}

export function getTripsByMember(): Promise<MemberTripCount[]> {
  return request<MemberTripCount[]>('reports_trips_by_member')
}

export function getProjection(): Promise<Projection[]> {
  return request<Projection[]>('reports_projection')
}

/** Confirmar o descartar una sugerencia de proyección (SPEC §7.2). */
export function decideProjection(name: string, confirmed: boolean): Promise<boolean> {
  return request<boolean>('projection_decide', { name, confirmed, by: ME })
}
