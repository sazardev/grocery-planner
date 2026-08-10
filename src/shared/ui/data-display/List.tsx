import type { CSSProperties, ReactNode } from 'react'
import styles from './List.module.css'

export type ListGap = '1' | '2' | '3' | '4'

const gapVar: Record<ListGap, string> = {
  '1': 'var(--gp-space-1)',
  '2': 'var(--gp-space-2)',
  '3': 'var(--gp-space-3)',
  '4': 'var(--gp-space-4)',
}

interface ListProps {
  as?: 'ul' | 'div'
  gap?: ListGap
  /** 2 = en pantallas anchas (≥1280px) la lista se reparte en dos columnas. */
  columns?: 1 | 2
  className?: string
  children: ReactNode
}

export default function List({
  as: Tag = 'ul',
  gap = '1',
  columns = 1,
  className,
  children,
}: ListProps) {
  const classes = [
    styles.list,
    columns === 2 ? styles.columns2 : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      className={classes}
      style={{ '--gp-list-gap': gapVar[gap] } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
