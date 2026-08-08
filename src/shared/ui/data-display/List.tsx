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
  className?: string
  children: ReactNode
}

export default function List({
  as: Tag = 'ul',
  gap = '1',
  className,
  children,
}: ListProps) {
  return (
    <Tag
      className={`${styles.list} ${className ?? ''}`}
      style={{ '--gp-list-gap': gapVar[gap] } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
