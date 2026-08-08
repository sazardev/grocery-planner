import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import Field from './Field.tsx'
import styles from './PickerTrigger.module.css'

interface PickerTriggerProps {
  label?: string
  hint?: string
  error?: string
  value: string
  placeholder: string
  icon: ReactNode
  open: boolean
  onOpen: () => void
  /** Etiqueta de accesibilidad del botón. */
  ariaLabel: string
}

export default function PickerTrigger({
  label,
  hint,
  error,
  value,
  placeholder,
  icon,
  open,
  onOpen,
  ariaLabel,
}: PickerTriggerProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      <button
        type="button"
        className={styles.trigger}
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={styles.icon} aria-hidden="true">
          {icon}
        </span>
        <span className={value ? styles.value : styles.placeholder}>{value || placeholder}</span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
        />
      </button>
    </Field>
  )
}
