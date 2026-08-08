import type { InputHTMLAttributes } from 'react'
import { useId } from 'react'
import Field from './Field.tsx'
import styles from './Input.module.css'

export type InputSize = 'md' | 'lg'

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  error?: string
  hint?: string
  size?: InputSize
}

export default function Input({
  label,
  error,
  hint,
  size = 'md',
  id,
  className,
  ...rest
}: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const classes = [
    styles.input,
    styles[size],
    error ? styles.error : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Field htmlFor={inputId} label={label} hint={hint} error={error}>
      <input
        id={inputId}
        className={classes}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  )
}
