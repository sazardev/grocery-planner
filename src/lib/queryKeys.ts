/**
 * Invalidación centralizada de TanStack Query.
 *
 * Una sola fuente de verdad para refrescar lo que se ve en varias pantallas a
 * la vez (lista, calendario, reportes, avisos…) sin depender de cadenas de
 * queryKey duplicadas entre páginas.
 *
 * TanStack Query invalida por PREFIJO: `invalidateQueries({ queryKey: ['item', id] })`
 * refresca también `['item', id, 'history']` y `['item', id, 'chat']`.
 */

/** Invalida todo lo que muestra ítems de la lista (Home, Mío, Kiosk, pickers). */
export function invalidateItems(qc: QueryClientLike): void {
  qc.invalidateQueries({ queryKey: ['items'] })
  qc.invalidateQueries({ queryKey: ['mine'] })
  qc.invalidateQueries({ queryKey: ['kiosk', 'items'] })
  qc.invalidateQueries({ queryKey: ['chat-pick'] })
}

/** Invalida el detalle de un ítem y todo lo derivado (historial y chat). */
export function invalidateItemDetail(qc: QueryClientLike, id: string): void {
  qc.invalidateQueries({ queryKey: ['item', id] })
}

/** Invalida calendario + planes + eventos + mandados a la vez. */
export function invalidateCalendar(qc: QueryClientLike): void {
  qc.invalidateQueries({ queryKey: ['calendar'] })
  qc.invalidateQueries({ queryKey: ['family', 'events'] })
  qc.invalidateQueries({ queryKey: ['family', 'plans'] })
}

/** Invalida los reportes de la familia (top/gasto/mandados/proyección). */
export function invalidateReports(qc: QueryClientLike): void {
  qc.invalidateQueries({ queryKey: ['reports'] })
  qc.invalidateQueries({ queryKey: ['projection'] })
}

/** Invalida el historial total (HistoryPage y el timeline de FamilyPage). */
export function invalidateTimeline(qc: QueryClientLike): void {
  qc.invalidateQueries({ queryKey: ['timeline'] })
  qc.invalidateQueries({ queryKey: ['family', 'timeline'] })
}

export interface QueryClientLike {
  invalidateQueries(opts: { queryKey: unknown[] }): unknown
}
