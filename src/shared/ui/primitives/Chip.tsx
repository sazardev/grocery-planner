import type { ReactNode } from 'react'
import styles from './Chip.module.css'

export type ChipTone = 'default' | 'warning' | 'danger' | 'info' | 'muted'

interface ChipProps {
  tone?: ChipTone
  size?: 'sm' | 'md'
  icon?: ReactNode
  onClick?: () => void
  className?: string
  children: ReactNode
}

export default function Chip({
  tone = 'default',
  size = 'sm',
  icon,
  onClick,
  className,
  children,
}: ChipProps) {
  const classes = [styles.chip, styles[tone], styles[size], className ?? '']
    .filter(Boolean)
    .join(' ')

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick}>
        {icon && <span className={styles.icon}>{icon}</span>}
        {children}
      </button>
    )
  }

  return (
    <span className={classes}>
      {icon && <span className={styles.icon}>{icon}</span>}
      {children}
    </span>
  )
}
