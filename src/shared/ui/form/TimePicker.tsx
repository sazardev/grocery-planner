import { useState } from 'react'
import { Clock } from 'lucide-react'
import Button from '../primitives/Button.tsx'
import PickerTrigger from './PickerTrigger.tsx'
import PickerModal from './PickerModal.tsx'
import styles from './TimePicker.module.css'

export interface TimePickerProps {
  /** Hora en formato HH:MM. */
  value?: string
  onChange: (time: string) => void
  label?: string
  hint?: string
  error?: string
  placeholder?: string
}

const HOURS = Array.from({ length: 24 }, (_, h) => h)
const MINUTES = Array.from({ length: 12 }, (_, m) => m * 5)

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function parseTime(value: string | undefined): { hour: number; minute: number } | null {
  if (!value) return null
  const m = /^(\d{2}):(\d{2})$/.exec(value)
  if (!m) return null
  const hour = Number(m[1])
  const minute = Number(m[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

export default function TimePicker({
  value,
  onChange,
  label,
  hint,
  error,
  placeholder = 'Elige una hora',
}: TimePickerProps) {
  const parsed = parseTime(value)
  const [open, setOpen] = useState(false)
  const [hour, setHour] = useState<number | null>(parsed?.hour ?? null)
  const [minute, setMinute] = useState<number | null>(parsed?.minute ?? null)

  const openPicker = () => {
    const p = parseTime(value)
    setHour(p?.hour ?? null)
    setMinute(p?.minute ?? null)
    setOpen(true)
  }

  const confirm = () => {
    if (hour === null || minute === null) return
    onChange(`${pad(hour)}:${pad(minute)}`)
    setOpen(false)
  }

  const triggerValue = parsed ? `${pad(parsed.hour)}:${pad(parsed.minute)}` : ''

  const chipClass = (isSelected: boolean) => `${styles.chip} ${isSelected ? styles.chipSelected : ''}`

  return (
    <>
      <PickerTrigger
        label={label}
        hint={hint}
        error={error}
        value={triggerValue}
        placeholder={placeholder}
        icon={<Clock size={18} strokeWidth={2} aria-hidden="true" />}
        open={open}
        onOpen={openPicker}
        ariaLabel={label ?? 'Hora'}
      />

      <PickerModal open={open} onClose={() => setOpen(false)} title={triggerValue || placeholder}>
        <div className={styles.columns}>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Hora</div>
            <div className={styles.chips}>
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={chipClass(hour === h)}
                  onClick={() => setHour(h)}
                  aria-pressed={hour === h}
                  aria-label={`${pad(h)} horas`}
                >
                  {pad(h)}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>Minutos</div>
            <div className={styles.chips}>
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={chipClass(minute === m)}
                  onClick={() => setMinute(m)}
                  aria-pressed={minute === m}
                  aria-label={`${pad(m)} minutos`}
                >
                  {pad(m)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <Button onClick={confirm} disabled={hour === null || minute === null} full>
          Listo
        </Button>
      </PickerModal>
    </>
  )
}
