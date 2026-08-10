import { useEffect, useMemo, useRef, useState } from 'react'
import type { GroceryItem } from '../domain/item'
import type { Event } from '../domain/event'
import type { ShoppingTrip } from '../domain/trip'
import type { MessageRefKind } from '../domain/chat'
import { CalendarDays, Package, Search, ShoppingCart, UserRound, X } from 'lucide-react'
import styles from './MentionPicker.module.css'

export type PickerMode = 'all' | 'member' | 'item' | 'event' | 'trip'

export interface Suggestion {
  kind: 'member' | MessageRefKind
  id: string
  name: string
}

interface MentionPickerProps {
  open: boolean
  mode: PickerMode
  seed: string
  members: string[]
  items: GroceryItem[]
  events: Event[]
  trips: ShoppingTrip[]
  onPick: (s: Suggestion) => void
  onCancel: () => void
}

const KIND_HINT: Record<Suggestion['kind'], string> = {
  member: 'Persona',
  item: 'Ítem',
  event: 'Evento',
  trip: 'Mandado',
}

function KindIcon({ kind }: { kind: Suggestion['kind'] }) {
  const size = 16
  if (kind === 'member') return <UserRound size={size} strokeWidth={2} aria-hidden="true" />
  if (kind === 'item') return <Package size={size} strokeWidth={2} aria-hidden="true" />
  if (kind === 'event') return <CalendarDays size={size} strokeWidth={2} aria-hidden="true" />
  return <ShoppingCart size={size} strokeWidth={2} aria-hidden="true" />
}

/** Panel de menciones del chat: busca personas, ítems, eventos y mandados
 *  para insertarlos con un toque (estilo Messenger/WhatsApp). */
export default function MentionPicker({
  open,
  mode,
  seed,
  members,
  items,
  events,
  trips,
  onPick,
  onCancel,
}: MentionPickerProps) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQuery(seed)
      setActive(0)
      inputRef.current?.focus()
    }
  }, [open, seed])

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (s: string) => !q || s.toLowerCase().includes(q)
    const out: Suggestion[] = []
    if (mode === 'all' || mode === 'member') {
      for (const name of members) if (match(name)) out.push({ kind: 'member', id: name, name })
    }
    if (mode === 'all' || mode === 'item') {
      for (const it of items) if (match(it.name)) out.push({ kind: 'item', id: it.id, name: it.name })
    }
    if (mode === 'all' || mode === 'event') {
      for (const ev of events) if (match(ev.title)) out.push({ kind: 'event', id: ev.id, name: ev.title })
    }
    if (mode === 'all' || mode === 'trip') {
      for (const tr of trips) if (match(tr.title)) out.push({ kind: 'trip', id: tr.id, name: tr.title })
    }
    return out
  }, [query, mode, members, items, events, trips])

  useEffect(() => {
    if (active > suggestions.length - 1) setActive(0)
  }, [suggestions.length, active])

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-idx="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const s = suggestions[active]
      if (s) onPick(s)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  if (!open) return null

  return (
    <div className={styles.panel} role="dialog" aria-label="Insertar mención">
      <div className={styles.search}>
        <Search size={16} strokeWidth={2} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.searchInput}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Buscar persona, ítem, evento o mandado…"
          aria-label="Buscar qué mencionar"
        />
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onCancel}
          aria-label="Cerrar"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      {suggestions.length === 0 ? (
        <p className={styles.empty}>Sin resultados</p>
      ) : (
        <ul ref={listRef} className={styles.list}>
          {suggestions.map((s, i) => (
            <li key={`${s.kind}-${s.id}`} data-idx={i}>
              <button
                type="button"
                className={`${styles.row} ${i === active ? styles.active : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => onPick(s)}
              >
                <span className={styles.icon}>
                  <KindIcon kind={s.kind} />
                </span>
                <span className={styles.name}>{s.name}</span>
                <span className={styles.hint}>{KIND_HINT[s.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
