import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './IconButton.module.css'

export type IconButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: 'sm' | 'md' | 'lg'
  label: string
  children: ReactNode
}

export default function IconButton({
  variant = 'ghost',
  size = 'md',
  label,
  className,
  children,
  ...rest
}: IconButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  )
}
