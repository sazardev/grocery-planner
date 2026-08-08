import type { ReactNode } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  Info,
  TriangleAlert,
  X,
} from 'lucide-react'
import styles from './Alert.module.css'

export type AlertTone = 'info' | 'warning' | 'danger' | 'success'

const defaultIcons: Record<AlertTone, ReactNode> = {
  info: <Info size={20} strokeWidth={2.5} aria-hidden="true" />,
  warning: <TriangleAlert size={20} strokeWidth={2.5} aria-hidden="true" />,
  danger: <CircleAlert size={20} strokeWidth={2.5} aria-hidden="true" />,
  success: <CheckCircle2 size={20} strokeWidth={2.5} aria-hidden="true" />,
}

interface AlertProps {
  tone?: AlertTone
  icon?: ReactNode
  title?: string
  children?: ReactNode
  onClose?: () => void
}

export default function Alert({
  tone = 'info',
  icon,
  title,
  children,
  onClose,
}: AlertProps) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role="alert">
      <span className={styles.icon}>{icon ?? defaultIcons[tone]}</span>
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.body}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Cerrar aviso"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
