import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'

export interface FabConfig {
  label: string
  ariaLabel?: string
  icon?: ReactNode
  onClick: () => void
}

export const FabConfigContext = createContext<FabConfig | null>(null)
export const FabSetContext = createContext<(c: FabConfig | null) => void>(() => {})

/** Registra el FAB de la página actual. Se limpia al desmontar la página. */
export function useFab(config: FabConfig | null | undefined) {
  const setConfig = useContext(FabSetContext)
  useEffect(() => {
    setConfig(config ?? null)
    return () => setConfig(null)
  }, [config, setConfig])
}
