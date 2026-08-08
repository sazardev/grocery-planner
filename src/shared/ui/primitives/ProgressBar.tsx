import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  /** Valor actual (0–max). */
  value: number
  max?: number
  label?: string
  showValue?: boolean
}

export default function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
}: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max)
  const percent = max === 0 ? 0 : (clamped / max) * 100

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.head}>
          <span className={styles.label}>{label}</span>
          {showValue && <span className={`${styles.value} numeric`}>{`${clamped} de ${max}`}</span>}
        </div>
      )}
      <div className={styles.track} role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={max}>
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
