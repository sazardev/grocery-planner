/** Helpers de fecha (sin librerías externas), todo en hora local. */

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): string {
  return toISODate(new Date())
}

export function parseISO(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(date: string, days: number): string {
  const d = parseISO(date)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

export function addMonths(date: string, months: number): string {
  const d = parseISO(date)
  d.setMonth(d.getMonth() + months)
  return toISODate(d)
}

export function addYears(date: string, years: number): string {
  const d = parseISO(date)
  d.setFullYear(d.getFullYear() + years)
  return toISODate(d)
}

/** Lunes de la semana que contiene `date`. */
export function startOfWeek(date: string): string {
  const d = parseISO(date)
  const dow = (d.getDay() + 6) % 7 // lunes = 0
  d.setDate(d.getDate() - dow)
  return toISODate(d)
}

export function startOfMonth(date: string): string {
  const d = parseISO(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function startOfYear(date: string): string {
  return `${parseISO(date).getFullYear()}-01-01`
}

/** Formatea "AAAA-MM-DD" para mostrar ("sáb 15 ago"). */
export function formatDate(date: string): string {
  const d = parseISO(date)
  return d.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
}

export function formatDateLong(date: string): string {
  const d = parseISO(date)
  return d.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** Formatea una fecha/hora ISO con la hora ("15 ago, 18:30"). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  return `${date}, ${time}`
}

/**
 * Convierte un día local (AAAA-MM-DD) a los límites ISO UTC que lo cubren.
 * Sirve para consultar el historial: los timestamps del backend son UTC y
 * el día local puede caer en fechas UTC distintas.
 */
export function localDayRangeISO(day: string): { start: string; end: string } {
  const [y, m, d] = day.split('-').map(Number)
  const start = new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0)
  const end = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString() }
}

/** Rango ISO UTC de una ventana local [startDay, endDay] inclusive. */
export function localWindowRangeISO(startDay: string, endDay: string): { start: string; end: string } {
  const [y, m, d] = endDay.split('-').map(Number)
  const start = localDayRangeISO(startDay).start
  const end = new Date(y, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999).toISOString()
  return { start, end }
}
