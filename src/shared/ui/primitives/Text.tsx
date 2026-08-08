import type { ElementType, ReactNode } from 'react'
import styles from './Text.module.css'

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'section'
  | 'item'
  | 'body'
  | 'label'
  | 'note'

export type TextTone =
  | 'default'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'

export type TextWeight = 'regular' | 'medium' | 'semibold' | 'bold'

interface TextProps {
  as?: ElementType
  variant?: TextVariant
  tone?: TextTone
  weight?: TextWeight
  numeric?: boolean
  uppercase?: boolean
  truncate?: boolean
  align?: 'left' | 'center' | 'right'
  className?: string
  children: ReactNode
}

const defaultTag: Record<TextVariant, ElementType> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  section: 'h2',
  item: 'span',
  body: 'p',
  label: 'span',
  note: 'span',
}

export default function Text({
  as,
  variant = 'body',
  tone = 'default',
  weight,
  numeric = false,
  uppercase = false,
  truncate = false,
  align,
  className,
  children,
}: TextProps) {
  const Tag = as ?? defaultTag[variant]
  const classes = [
    styles.text,
    styles[variant],
    styles[tone],
    weight ? styles[`weight-${weight}`] : '',
    numeric ? styles.numeric : '',
    uppercase ? styles.uppercase : '',
    truncate ? styles.truncate : '',
    align ? styles[`align-${align}`] : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <Tag className={classes}>{children}</Tag>
}
