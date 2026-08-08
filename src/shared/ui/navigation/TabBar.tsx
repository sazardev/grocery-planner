import type { ReactNode } from 'react'
import styles from './TabBar.module.css'

export interface TabItem {
  key: string
  label: string
  icon?: ReactNode
}

interface TabBarProps {
  items: TabItem[]
  active: string
  onChange: (key: string) => void
  label?: string
  className?: string
}

export default function TabBar({
  items,
  active,
  onChange,
  label = 'Filtros',
  className,
}: TabBarProps) {
  const classes = [styles.tabs, className ?? ''].filter(Boolean).join(' ')

  return (
    <div className={classes} role="tablist" aria-label={label}>
      {items.map((item) => {
        const isActive = item.key === active
        const tabClass = [styles.tab, isActive ? styles.active : '']
          .filter(Boolean)
          .join(' ')

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            className={tabClass}
            aria-selected={isActive}
            onClick={() => onChange(item.key)}
          >
            {item.icon && <span className={styles.icon}>{item.icon}</span>}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
