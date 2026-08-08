import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Info, X } from 'lucide-react'
import styles from './Toast.module.css'

export type ToastTone = 'default' | 'success' | 'danger'

const icons: Record<ToastTone, ReactNode> = {
  default: <Info size={18} strokeWidth={2.5} aria-hidden="true" />,
  success: <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />,
  danger: <CircleAlert size={18} strokeWidth={2.5} aria-hidden="true" />,
}

interface ToastProps {
  open: boolean
  tone?: ToastTone
  title?: string
  message?: string
  onClose?: () => void
  duration?: number
}

export default function Toast({
  open,
  tone = 'default',
  title,
  message,
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (!open || duration <= 0) return
    const timer = setTimeout(() => {
      onClose?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [open, duration, onClose])

  return (
    <div
      className={`${styles.toast} ${styles[tone]} ${open ? styles.open : ''}`}
      role="status"
    >
      <span className={styles.icon}>{icons[tone]}</span>
      <div className={styles.content}>
        {title && <p className={styles.title}>{title}</p>}
        {message && <p className={styles.message}>{message}</p>}
      </div>
      {onClose && (
        <button
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Cerrar notificación"
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
