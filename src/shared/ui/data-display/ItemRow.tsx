import type { KeyboardEvent } from 'react'
import Avatar from '../primitives/Avatar.tsx'
import Checkbox from '../primitives/Checkbox.tsx'
import Chip, { type ChipTone } from '../primitives/Chip.tsx'
import Text from '../primitives/Text.tsx'
import styles from './ItemRow.module.css'

export type ItemRowStatus = 'falta' | 'pedido' | 'llevo' | 'comprado' | 'cancelado'

interface ItemRowProps {
  name: string
  quantity?: number
  unit?: string
  requestedBy: string
  requestedBySrc?: string
  assignedTo?: string
  note?: string
  status?: ItemRowStatus
  urgent?: boolean
  checked?: boolean
  onToggle?: () => void
  onClick?: () => void
  actionLabel?: string
  compact?: boolean
  as?: 'li' | 'div'
}

const statusTone: Record<ItemRowStatus, ChipTone> = {
  falta: 'default',
  pedido: 'muted',
  llevo: 'default',
  comprado: 'muted',
  cancelado: 'danger',
}

export default function ItemRow({
  name,
  quantity,
  unit,
  requestedBy,
  requestedBySrc,
  assignedTo,
  note,
  status,
  urgent = false,
  checked = false,
  onToggle,
  onClick,
  actionLabel,
  compact = false,
  as: Tag = 'div',
}: ItemRowProps) {
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
    styles.row,
    carried ? styles.carried : '',
    done ? styles.done : '',
    compact ? styles.compact : '',
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
      <span onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={checked}
          onChange={onToggle}
          size={compact ? 'sm' : 'md'}
          ariaLabel={`${name}: ${checked ? 'ya lo llevo' : 'marcar como ya lo llevo'}`}
        />
      </span>
      <div className={styles.body}>
        <div className={styles.line}>
          <Text
            variant="item"
            truncate
            tone={carried ? 'success' : 'default'}
            className={nameClasses}
          >
            {name}
          </Text>
          {(quantity != null || unit) && (
            <Text variant="note" tone="secondary" numeric>
              {qtyText}
            </Text>
          )}
        </div>
        <div className={styles.meta}>
          <Avatar name={requestedBy} src={requestedBySrc} size="sm" />
          <span>{requestedBy}</span>
          {assignedTo && <span className={styles.assign}>· lleva {assignedTo}</span>}
          {note && <span className={styles.note}>· {note}</span>}
        </div>
      </div>
      <div className={styles.chips}>
        {urgent && <Chip tone="warning">Urgente</Chip>}
        {status && <Chip tone={statusTone[status]}>{actionLabel ?? status.toUpperCase()}</Chip>}
      </div>
    </Tag>
  )
}
