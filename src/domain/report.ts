export interface TopProduct {
  name: string
  timesBought: number
}

export interface SpendingReport {
  total: number
  itemsCount: number
}

export interface MemberTripCount {
  member: string
  trips: number
}

export interface Projection {
  name: string
  quantity: number
  unit: string
  lastBoughtAt?: string
  cadenceDays?: number
  estFaltaInDays?: number
  /** ¿La familia ya decidió sobre esta sugerencia? (SPEC §7.2) */
  decided: boolean
  /** Si la decidió, ¿la confirmó o la descartó? */
  confirmed?: boolean
}
