import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Spinner from './Spinner.tsx'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  loading?: boolean
  iconLeft?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  full = false,
  loading = false,
  iconLeft,
  iconRight,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    full ? styles.full : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <Spinner size="sm" />
      ) : (
        iconLeft && <span className={styles.icon}>{iconLeft}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && <span className={styles.icon}>{iconRight}</span>}
    </button>
  )
}
