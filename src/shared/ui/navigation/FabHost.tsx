import { useState } from 'react'
import type { ReactNode } from 'react'
import FAB from './FAB.tsx'
import { FabConfigContext, FabSetContext } from './fab.ts'
import type { FabConfig } from './fab.ts'

/**
 * Provee un único FAB contextual por pantalla, anclado sobre la barra de
 * navegación. Cada página registra su acción con `useFab(...)` (o nada si no
 * aplica); `FabHost` lo pinta una sola vez desde el Layout.
 */
export function FabProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<FabConfig | null>(null)
  return (
    <FabSetContext.Provider value={setConfig}>
      <FabConfigContext.Provider value={config}>{children}</FabConfigContext.Provider>
    </FabSetContext.Provider>
  )
}

/** Renderiza el FAB registrado (si lo hay) por encima de la nav inferior. */
export function FabHost() {
  return (
    <FabConfigContext.Consumer>
      {(config) =>
        config ? (
          <FAB
            extended
            label={config.label}
            ariaLabel={config.ariaLabel ?? config.label}
            icon={config.icon}
            onClick={config.onClick}
          />
        ) : null
      }
    </FabConfigContext.Consumer>
  )
}
