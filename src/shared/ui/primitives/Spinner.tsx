import styles from './Spinner.module.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  tone?: 'default' | 'inverse'
}

export default function Spinner({ size = 'md', tone = 'default' }: SpinnerProps) {
  return (
    <span
      className={`${styles.spinner} ${styles[size]} ${styles[tone]}`}
      role="status"
      aria-label="Cargando"
    >
      <span className={styles.dot} />
    </span>
  )
}
