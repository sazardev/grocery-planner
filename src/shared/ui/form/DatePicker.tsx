import { useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import PickerTrigger from './PickerTrigger.tsx'
import PickerModal from './PickerModal.tsx'
import styles from './DatePicker.module.css'

export interface DatePickerProps {
  /** Fecha en formato AAAA-MM-DD. */
  value?: string
  onChange: (date: string) => void
  /** Fecha mínima seleccionable (AAAA-MM-DD). */
  min?: string
  label?: string
  hint?: string
  error?: string
  placeholder?: string
}

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

const WEEKDAYS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

function parseIso(value: string | undefined): Date | null {
  if (!value) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatLabel(date: Date): string {
  return date.toLocaleDateString('es', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function DatePicker({
  value,
  onChange,
  min,
  label,
  hint,
  error,
  placeholder = 'Elige una fecha',
}: DatePickerProps) {
  const selected = parseIso(value)
  const today = new Date()
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate())
  const minDate = parseIso(min)
  const [open, setOpen] = useState(false)

  const [viewYear, setViewYear] = useState(() => selected?.getFullYear() ?? today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => selected?.getMonth() ?? today.getMonth())

  const grid = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1)
    const offset = (first.getDay() + 6) % 7
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const days: (number | null)[] = []
    for (let i = 0; i < offset; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [viewYear, viewMonth])

  const goTo = (delta: number) => {
    let y = viewYear
    let m = viewMonth + delta
    if (m < 0) {
      m = 11
      y -= 1
    }
    if (m > 11) {
      m = 0
      y += 1
    }
    setViewYear(y)
    setViewMonth(m)
  }

  const select = (day: number) => {
    onChange(toIso(viewYear, viewMonth, day))
    setOpen(false)
  }

  const triggerValue = selected ? formatLabel(selected) : ''

  return (
    <>
      <PickerTrigger
        label={label}
        hint={hint}
        error={error}
        value={triggerValue}
        placeholder={placeholder}
        icon={<CalendarDays size={18} strokeWidth={2} aria-hidden="true" />}
        open={open}
        onOpen={() => setOpen(true)}
        ariaLabel={label ?? 'Fecha'}
      />

      <PickerModal open={open} onClose={() => setOpen(false)} title={triggerValue || placeholder}>
        <div className={styles.calendar}>
          <div className={styles.header}>
            <button
              type="button"
              className={styles.nav}
              onClick={() => goTo(-1)}
              aria-label="Mes anterior"
            >
              <ChevronLeft size={20} strokeWidth={2} aria-hidden="true" />
            </button>
            <div className={styles.title} aria-live="polite">
              {MONTHS[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              className={styles.nav}
              onClick={() => goTo(1)}
              aria-label="Mes siguiente"
            >
              <ChevronRight size={20} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>

          <div className={styles.weekdays}>
            {WEEKDAYS.map((w) => (
              <span key={w} className={styles.weekday}>
                {w}
              </span>
            ))}
          </div>

          <div className={styles.grid}>
            {grid.map((day, i) => {
              if (day === null) return <span key={i} className={styles.empty} />
              const iso = toIso(viewYear, viewMonth, day)
              const isSelected = selected ? toIso(selected.getFullYear(), selected.getMonth(), selected.getDate()) === iso : false
              const isToday = iso === todayIso
              const isDisabled = minDate ? iso < toIso(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : false
              const classes = [
                styles.day,
                isToday ? styles.today : '',
                isSelected ? styles.selected : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={i}
                  type="button"
                  className={classes}
                  onClick={() => select(day)}
                  disabled={isDisabled}
                  aria-pressed={isSelected}
                  aria-label={`${day} de ${MONTHS[viewMonth]} de ${viewYear}`}
                >
                  {day}
                </button>
              )
            })}
          </div>
        </div>
      </PickerModal>
    </>
  )
}
