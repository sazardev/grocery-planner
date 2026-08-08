import styles from './Switch.module.css'

export type SwitchSize = 'sm' | 'md'

export interface SwitchProps {
  checked: boolean
  onChange?: (checked: boolean) => void
  label?: string
  disabled?: boolean
  size?: SwitchSize
}

export default function Switch({
  checked,
  onChange,
  label,
  disabled = false,
  size = 'md',
}: SwitchProps) {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''}`}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
        disabled={disabled}
      />
      <span
        className={`${styles.track} ${styles[size]} ${checked ? styles.checked : ''}`}
        aria-hidden="true"
      />
      {label && <span>{label}</span>}
    </label>
  )
}
