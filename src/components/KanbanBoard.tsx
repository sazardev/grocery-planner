import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { GroceryItem, ItemStatus } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import styles from './KanbanBoard.module.css'

/** Columnas del tablero: el ciclo de vida del ítem (SPEC §4.3). */
const COLUMNS: ItemStatus[] = ['falta', 'pedido', 'llevo', 'comprado']

const COLUMN_TITLE: Record<ItemStatus, string> = {
  falta: 'Falta',
  pedido: 'Pedido',
  llevo: 'Ya lo llevo',
  comprado: 'Comprado',
  cancelado: 'Cancelado',
}

/** Destinos permitidos por estado (alineado con la máquina de estados del backend). */
const CAN_MOVE_TO: Record<ItemStatus, ItemStatus[]> = {
  falta: ['pedido', 'llevo'],
  pedido: ['falta', 'llevo', 'comprado'],
  llevo: ['falta', 'comprado'],
  comprado: [],
  cancelado: [],
}

function prevStatus(s: ItemStatus): ItemStatus | null {
  if (s === 'pedido') return 'falta'
  if (s === 'llevo') return 'falta'
  return null
}

function nextStatus(s: ItemStatus): ItemStatus | null {
  if (s === 'falta') return 'pedido'
  if (s === 'pedido') return 'llevo'
  if (s === 'llevo') return 'comprado'
  return null
}

interface KanbanBoardProps {
  items: GroceryItem[]
  onMove: (id: string, to: ItemStatus) => void
  onOpen: (id: string) => void
}

export default function KanbanBoard({ items, onMove, onOpen }: KanbanBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ItemStatus | null>(null)
  const dragInfo = useRef<{ id: string; from: ItemStatus } | null>(null)

  const canDropTo = (from: ItemStatus | null, col: ItemStatus) =>
    from != null && CAN_MOVE_TO[from].includes(col)

  const cleanup = () => {
    dragInfo.current = null
    setDragId(null)
    setOverCol(null)
  }

  const handleDragStart = (e: DragEvent, item: GroceryItem) => {
    dragInfo.current = { id: item.id, from: item.status }
    setDragId(item.id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', item.id)
  }

  const handleDragOver = (e: DragEvent, col: ItemStatus) => {
    e.preventDefault()
    const can = canDropTo(dragInfo.current?.from ?? null, col)
    e.dataTransfer.dropEffect = can ? 'move' : 'none'
    setOverCol((prev) => (prev === (can ? col : null) ? prev : can ? col : null))
  }

  const handleDrop = (e: DragEvent, col: ItemStatus) => {
    e.preventDefault()
    const info = dragInfo.current
    if (info && canDropTo(info.from, col)) onMove(info.id, col)
    cleanup()
  }

  return (
    <div className={styles.board} role="group" aria-label="Tablero kanban de la lista">
      {COLUMNS.map((col) => {
        const colItems = items.filter((i) => i.status === col)
        return (
          <section
            key={col}
            className={`${styles.column} ${overCol === col ? styles.columnOver : ''}`}
            onDragOver={(e) => handleDragOver(e, col)}
            onDragLeave={() => setOverCol((prev) => (prev === col ? null : prev))}
            onDrop={(e) => handleDrop(e, col)}
            aria-label={`Columna ${COLUMN_TITLE[col]}`}
          >
            <header className={styles.columnHeader}>
              <Text variant="label" uppercase tone="secondary">
                {COLUMN_TITLE[col]}
              </Text>
              <span className={styles.columnCount}>{colItems.length}</span>
            </header>
            <div className={styles.cardList}>
              {colItems.map((item) => (
                <KanbanCard
                  key={item.id}
                  item={item}
                  dragging={item.id === dragId}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={cleanup}
                  onOpen={() => onOpen(item.id)}
                  onMove={onMove}
                />
              ))}
              {colItems.length === 0 && <p className={styles.empty}>Vacío</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

interface KanbanCardProps {
  item: GroceryItem
  dragging: boolean
  onDragStart: (e: DragEvent) => void
  onDragEnd: () => void
  onOpen: () => void
  onMove: (id: string, to: ItemStatus) => void
}

function KanbanCard({ item, dragging, onDragStart, onDragEnd, onOpen, onMove }: KanbanCardProps) {
  const carried = item.status === 'llevo'
  const done = item.status === 'comprado'
  const prev = prevStatus(item.status)
  const next = nextStatus(item.status)
  const qtyText = [item.quantity, item.unit].filter((v) => v != null).join(' ')

  const classes = [
    styles.card,
    dragging ? styles.cardDragging : '',
    carried ? styles.cardCarried : '',
    done ? styles.cardDone : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <article
      className={classes}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cardTop}>
        <Text variant="item" tone={carried ? 'success' : 'default'}>
          {item.name}
        </Text>
        {item.priority === 'urgente' && <Chip tone="warning">Urgente</Chip>}
      </div>
      {(item.quantity != null || item.unit) && (
        <Text variant="note" tone="secondary" numeric>
          {qtyText}
        </Text>
      )}
      <div className={styles.meta}>
        <Avatar name={item.requestedBy} size="sm" />
        <span>{item.requestedBy}</span>
      </div>
      <div className={styles.moves}>
        {prev && (
          <button
            type="button"
            className={styles.moveBtn}
            onClick={(e) => {
              e.stopPropagation()
              onMove(item.id, prev)
            }}
            aria-label={`Mover ${item.name} a ${COLUMN_TITLE[prev]}`}
            title={`Mover a ${COLUMN_TITLE[prev]}`}
          >
            <ChevronLeft size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
        {next && (
          <button
            type="button"
            className={styles.moveBtn}
            onClick={(e) => {
              e.stopPropagation()
              onMove(item.id, next)
            }}
            aria-label={`Mover ${item.name} a ${COLUMN_TITLE[next]}`}
            title={`Mover a ${COLUMN_TITLE[next]}`}
          >
            <ChevronRight size={16} strokeWidth={2.5} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  )
}
