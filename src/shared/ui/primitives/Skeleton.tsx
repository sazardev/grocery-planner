import type { CSSProperties } from 'react'
import styles from './Skeleton.module.css'

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect'
  width?: number | string
  height?: number | string
  className?: string
  style?: CSSProperties
}

export default function Skeleton({
  variant = 'text',
  width,
  height,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={`${styles.skeleton} ${styles[variant]} ${className ?? ''}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  )
}
