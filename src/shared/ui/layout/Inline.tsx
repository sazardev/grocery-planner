import type { CSSProperties, ElementType, ReactNode } from 'react'
import type { Spacing } from './spacing.ts'
import { spaceVar } from './spacing.ts'
import styles from './Inline.module.css'

interface InlineProps {
  as?: ElementType
  gap?: Spacing
  align?: 'start' | 'center' | 'end' | 'baseline' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
  wrap?: boolean
  className?: string
  style?: CSSProperties
  children: ReactNode
}

export default function Inline({
  as: Tag = 'div',
  gap = '2',
  align = 'center',
  justify,
  wrap = false,
  className,
  style,
  children,
}: InlineProps) {
  const classes = [
    styles.inline,
    styles[`align-${align}`],
    justify ? styles[`justify-${justify}`] : '',
    wrap ? styles.wrap : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Tag
      className={classes}
      style={{ '--gp-inline-gap': spaceVar[gap], ...style } as CSSProperties}
    >
      {children}
    </Tag>
  )
}
