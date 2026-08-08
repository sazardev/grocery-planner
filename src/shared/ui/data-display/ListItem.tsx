import type { KeyboardEvent, ReactNode } from 'react'
import styles from './ListItem.module.css'

interface ListItemProps {
  leading?: ReactNode
  title: ReactNode
  description?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  selected?: boolean
  disabled?: boolean
  className?: string
  as?: 'li' | 'div'
}

export default function ListItem({
  leading,
  title,
  description,
  trailing,
  onClick,
  selected = false,
  disabled = false,
  className,
  as: Tag = 'li',
}: ListItemProps) {
  const interactive = Boolean(onClick) || selected

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (disabled || !onClick) return
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.key === ' ') e.preventDefault()
      onClick()
    }
  }

  const classes = [
    styles.item,
    interactive ? styles.interactive : '',
    onClick ? styles.clickable : '',
    selected ? styles.selected : '',
    disabled ? styles.disabled : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      className={classes}
      role={onClick && !disabled ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {leading && <div className={styles.leading}>{leading}</div>}
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {trailing && <div className={styles.trailing}>{trailing}</div>}
    </Tag>
  )
}
