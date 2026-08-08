import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type BadgeTone = 'default' | 'warning' | 'danger' | 'info' | 'muted'

interface BadgeProps {
  tone?: BadgeTone
  count?: number
  dot?: boolean
  children?: ReactNode
}

export default function Badge({ tone = 'default', count, dot = false, children }: BadgeProps) {
  if (count !== undefined) {
    return (
      <span className={`${styles.badge} ${styles[tone]}`} aria-label={`${count} pendientes`}>
        {count > 99 ? '99+' : count}
      </span>
    )
  }

  if (dot) {
    return <span className={`${styles.dot} ${styles[tone]}`} aria-hidden="true" />
  }

  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
