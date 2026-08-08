import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import styles from './FAB.module.css'

interface FABProps {
  icon?: ReactNode
  label?: string
  onClick?: () => void
  extended?: boolean
  size?: 'md' | 'lg'
  full?: boolean
  active?: boolean
  ariaLabel?: string
  className?: string
}

export default function FAB({
  icon = <Plus />,
  label,
  onClick,
  extended = false,
  size = 'md',
  full = false,
  active = false,
  ariaLabel,
  className,
}: FABProps) {
  const classes = [
    styles.fab,
    extended ? styles.extended : styles.circle,
    size === 'lg' ? styles.lg : '',
    full ? styles.full : '',
    active ? styles.active : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-expanded={active || undefined}
    >
      <span className={`${styles.icon} ${active ? styles.iconActive : ''}`}>{icon}</span>
      {label && <span className={styles.label}>{label}</span>}
    </button>
  )
}
