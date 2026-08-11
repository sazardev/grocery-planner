import type { KeyboardEvent } from 'react'
import Avatar from '../primitives/Avatar.tsx'
import Checkbox from '../primitives/Checkbox.tsx'
import Chip, { type ChipTone } from '../primitives/Chip.tsx'
import Text from '../primitives/Text.tsx'
import { STATUS_LABEL, type ItemStatus } from '../../../domain/item'
import styles from './ItemCard.module.css'

export type ItemCardStatus = 'falta' | 'pedido' | 'llevo' | 'comprado' | 'cancelado'

interface ItemCardProps {
  name: string
  quantity?: number
  unit?: string
  requestedBy: string
  requestedBySrc?: string
  assignedTo?: string
  store?: string
  aisle?: string
  commentCount?: number
  photoCount?: number
  note?: string
  status?: ItemCardStatus
  urgent?: boolean
  checked?: boolean
  disabled?: boolean
  onToggle?: () => void
  onClick?: () => void
  actionLabel?: string
  as?: 'li' | 'div'
}

const statusTone: Record<ItemCardStatus, ChipTone> = {
  falta: 'default',
  pedido: 'muted',
  llevo: 'default',
  comprado: 'muted',
  cancelado: 'danger',
}

/** Tarjeta de ítem para la vista en cuadrícula (rejilla fluida, §4.4). */
export default function ItemCard({
  name,
  quantity,
  unit,
  requestedBy,
  requestedBySrc,
  assignedTo,
  store,
  aisle,
  commentCount,
  photoCount,
  note,
  status,
  urgent = false,
  checked = false,
  disabled = false,
  onToggle,
  onClick,
  actionLabel,
  as: Tag = 'div',
}: ItemCardProps) {
  const carried = status === 'llevo'
  const done = status === 'comprado' || status === 'cancelado'
  const qtyText = [quantity, unit].filter((v) => v != null).join(' ')

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ') e.preventDefault()
      onClick()
    }
  }

  const classes = [
    styles.card,
    carried ? styles.carried : '',
    done ? styles.done : '',
  ]
    .filter(Boolean)
    .join(' ')

  const nameClasses = [styles.name, done ? styles.struck : ''].filter(Boolean).join(' ')

  return (
    <Tag
      className={classes}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.top}>
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={checked}
            onChange={onToggle}
            disabled={disabled}
            size="sm"
            ariaLabel={
              disabled && status
                ? `${name}: ${STATUS_LABEL[status as ItemStatus]}`
                : `${name}: ${checked ? 'quitar del carrito' : 'decir que ya lo llevo'}`
            }
          />
        </span>
        <div className={styles.chips}>
          {urgent && <Chip tone="warning">Urgente</Chip>}
          {status && (
            <Chip tone={statusTone[status]}>
              {actionLabel ?? STATUS_LABEL[status as ItemStatus]}
            </Chip>
          )}
        </div>
      </div>

      <Text variant="item" className={nameClasses}>
        {name}
      </Text>

      {(quantity != null || unit) && (
        <Text variant="note" tone="secondary" numeric>
          {qtyText}
        </Text>
      )}

      <div className={styles.meta}>
        <Avatar name={requestedBy} src={requestedBySrc} size="sm" />
        <span className={styles.metaText}>
          {requestedBy}
          {assignedTo && <span className={styles.assign}> · lleva {assignedTo}</span>}
        </span>
      </div>

      {(store || aisle) && (
        <Text variant="note" tone="tertiary" truncate>
          {[store, aisle].filter(Boolean).join(' › ')}
        </Text>
      )}

      {(!!photoCount || !!commentCount) && (
        <Text variant="note" tone="tertiary">
          {[photoCount ? `📷 ${photoCount}` : '', commentCount ? `💬 ${commentCount}` : '']
            .filter(Boolean)
            .join(' · ')}
        </Text>
      )}

      {note && (
        <Text variant="note" tone="tertiary" truncate>
          {note}
        </Text>
      )}
    </Tag>
  )
}
