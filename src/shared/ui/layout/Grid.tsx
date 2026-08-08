import type { ReactNode } from 'react'
import styles from './Grid.module.css'

interface GridProps {
  /** Columnas en el breakpoint más pequeño (1–4). */
  cols?: 1 | 2 | 3 | 4
  /** Columnas desde ≥768px (tablet). */
  colsMd?: 1 | 2 | 3 | 4
  /** Columnas desde ≥1024px (desktop). */
  colsLg?: 1 | 2 | 3 | 4
  gap?: '1' | '2' | '3' | '4' | '5' | '6'
  className?: string
  children: ReactNode
}

export default function Grid({
  cols = 1,
  colsMd,
  colsLg,
  gap = '3',
  className,
  children,
}: GridProps) {
  const classes = [
    styles.grid,
    styles[`cols-${cols}`],
    colsMd ? styles[`cols-md-${colsMd}`] : '',
    colsLg ? styles[`cols-lg-${colsLg}`] : '',
    styles[`gap-${gap}`],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={classes}>{children}</div>
}
