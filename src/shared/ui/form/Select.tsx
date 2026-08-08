import type { ReactNode, SelectHTMLAttributes } from 'react'
import { useId } from 'react'
import { ChevronDown } from 'lucide-react'
import Field from './Field.tsx'
import styles from './Select.module.css'

export type SelectSize = 'md' | 'lg'

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  size?: SelectSize
  children?: ReactNode
}

export default function Select({
  label,
  error,
  hint,
  size = 'md',
  id,
  className,
  children,
  ...rest
}: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const classes = [
    styles.select,
    styles[size],
    error ? styles.error : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Field htmlFor={selectId} label={label} hint={hint} error={error}>
      <div className={styles.wrapper}>
        <select
          id={selectId}
          className={classes}
          aria-invalid={error ? true : undefined}
          {...rest}
        >
          {children}
        </select>
        <ChevronDown
          className={styles.chevron}
          size={20}
          strokeWidth={2}
          aria-hidden="true"
        />
      </div>
    </Field>
  )
}
