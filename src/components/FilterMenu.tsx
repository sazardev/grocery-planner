import { useEffect, useRef, useState } from 'react'
import { Filter } from 'lucide-react'
import Checkbox from '../shared/ui/primitives/Checkbox.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import styles from './FilterMenu.module.css'

export type FilterOptionKind = 'radio' | 'toggle'

export interface FilterOption {
  key: string
  label: string
  kind: FilterOptionKind
}

interface FilterMenuProps {
  options: FilterOption[]
  /** Claves de las opciones activas. */
  active: string[]
  /** Radio → selección única; toggle → marcar/desmarcar. */
  onSelect: (key: string, kind: FilterOptionKind) => void
}

/** Botón de filtros junto a la búsqueda; al tocar abre el desglose de opciones. */
export default function FilterMenu({ options, active, onSelect }: FilterMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const radioOptions = options.filter((o) => o.kind === 'radio')
  const toggleOptions = options.filter((o) => o.kind === 'toggle')
  const activeCount = options.filter((o) => active.includes(o.key)).length

  return (
    <div ref={rootRef} className={styles.menu}>
      <button
        type="button"
        className={`${styles.button} ${activeCount > 0 ? styles.buttonActive : ''}`}
        aria-expanded={open}
        aria-label={activeCount > 0 ? `Filtros, ${activeCount} activos` : 'Filtros'}
        onClick={() => setOpen((o) => !o)}
      >
        <Filter size={18} strokeWidth={2} aria-hidden="true" />
        {activeCount > 0 && <span className={styles.count}>{activeCount}</span>}
      </button>

      {open && (
        <div className={styles.dropdown} role="menu" aria-label="Opciones de filtro">
          {radioOptions.length > 0 && (
            <div className={styles.section}>
              <Text as="p" variant="label" tone="tertiary" uppercase>
                Estado
              </Text>
              {radioOptions.map((o) => (
                <label
                  key={o.key}
                  className={`${styles.option} ${active.includes(o.key) ? styles.optionActive : ''}`}
                  role="menuitemradio"
                  aria-checked={active.includes(o.key)}
                  onClick={() => onSelect(o.key, 'radio')}
                >
                  <span className={styles.radio} aria-hidden="true">
                    {active.includes(o.key) && <span className={styles.radioDot} />}
                  </span>
                  <Text variant="item">{o.label}</Text>
                </label>
              ))}
            </div>
          )}

          {toggleOptions.length > 0 && (
            <div className={styles.section}>
              <Text as="p" variant="label" tone="tertiary" uppercase>
                Filtros
              </Text>
              {toggleOptions.map((o) => (
                <label
                  key={o.key}
                  className={styles.option}
                  role="menuitemcheckbox"
                  aria-checked={active.includes(o.key)}
                >
                  <Checkbox
                    size="sm"
                    checked={active.includes(o.key)}
                    onChange={() => onSelect(o.key, 'toggle')}
                    label={o.label}
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
