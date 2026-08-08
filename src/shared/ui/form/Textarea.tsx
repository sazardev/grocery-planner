import type { TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import Field from './Field.tsx'
import styles from './Textarea.module.css'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  hint?: string
  rows?: number
}

export default function Textarea({
  label,
  error,
  hint,
  rows = 3,
  id,
  className,
  ...rest
}: TextareaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const classes = [styles.textarea, error ? styles.error : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <Field htmlFor={inputId} label={label} hint={hint} error={error}>
      <textarea
        id={inputId}
        rows={rows}
        className={classes}
        aria-invalid={error ? true : undefined}
        {...rest}
      />
    </Field>
  )
}
