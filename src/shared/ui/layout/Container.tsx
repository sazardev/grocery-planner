import type { ReactNode } from 'react'
import styles from './Container.module.css'

type ContainerSize = 'sm' | 'md' | 'lg' | 'xl'

interface ContainerProps {
  size?: ContainerSize
  padded?: boolean
  className?: string
  children: ReactNode
}

export default function Container({
  size = 'md',
  padded = true,
  className,
  children,
}: ContainerProps) {
  const classes = [
    styles.container,
    styles[size],
    padded ? styles.padded : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={classes}>{children}</div>
}
