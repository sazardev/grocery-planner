import type { CSSProperties, ElementType, ReactNode } from 'react'
import type { Spacing } from './spacing.ts'
import { spaceVar } from './spacing.ts'
import styles from './Stack.module.css'

interface StackProps {
  as?: ElementType
  gap?: Spacing
  align?: 'stretch' | 'start' | 'center' | 'end'
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function Stack({
  as: Tag = 'div',
  gap = '4',
  align = 'stretch',
  className,
  style,
  children,
}: StackProps) {
  return (
    <Tag
      className={`${styles.stack} ${styles[`align-${align}`]} ${className ?? ''}`}
      style={{ '--gp-stack-gap': spaceVar[gap], ...style } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
