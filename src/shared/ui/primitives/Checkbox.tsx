import { Check } from 'lucide-react'
import styles from './Checkbox.module.css'

interface CheckboxProps {
  checked: boolean
  onChange?: () => void
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  label?: string
  ariaLabel?: string
}

export default function Checkbox({
  checked,
  onChange,
  size = 'md',
  disabled = false,
  label,
  ariaLabel,
}: CheckboxProps) {
  return (
    <label className={`${styles.wrapper} ${disabled ? styles.disabled : ''}`}>
      <input
        type="checkbox"
        className={styles.input}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
      />
      <span
        className={`${styles.box} ${styles[size]} ${checked ? styles.checked : ''}`}
        aria-hidden="true"
      >
        {checked && <Check size={size === 'lg' ? 18 : 14} strokeWidth={2.5} />}
      </span>
      {label && <span>{label}</span>}
    </label>
  )
}
