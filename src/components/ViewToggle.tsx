import { LayoutGrid, List, SquareKanban } from 'lucide-react'
import type { ListViewMode } from '../lib/viewMode.ts'
import styles from './ViewToggle.module.css'

interface ViewToggleProps {
  view: ListViewMode
  onChange: (view: ListViewMode) => void
}

const MODES: { key: ListViewMode; label: string; icon: React.ReactNode }[] = [
  { key: 'list', label: 'Vista de lista', icon: <List size={18} strokeWidth={2} aria-hidden="true" /> },
  { key: 'grid', label: 'Vista de cuadrícula', icon: <LayoutGrid size={18} strokeWidth={2} aria-hidden="true" /> },
  { key: 'kanban', label: 'Tablero kanban', icon: <SquareKanban size={18} strokeWidth={2} aria-hidden="true" /> },
]

/** Alterna entre vista de lista, cuadrícula y tablero kanban. */
export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className={styles.toggle} role="group" aria-label="Vista de la lista">
      {MODES.map((m) => (
        <button
          key={m.key}
          type="button"
          className={`${styles.button} ${view === m.key ? styles.active : ''}`}
          aria-pressed={view === m.key}
          aria-label={m.label}
          title={m.label}
          onClick={() => onChange(m.key)}
        >
          {m.icon}
        </button>
      ))}
    </div>
  )
}
