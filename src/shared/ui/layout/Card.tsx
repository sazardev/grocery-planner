import type { HTMLAttributes, ReactNode } from 'react'
import styles from './Card.module.css'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean
  selected?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  children: ReactNode
}

export default function Card({
  interactive = false,
  selected = false,
  padding = 'md',
  className,
  children,
  ...rest
}: CardProps) {
  const classes = [
    styles.card,
    styles[`padding-${padding}`],
    interactive ? styles.interactive : '',
    selected ? styles.selected : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
