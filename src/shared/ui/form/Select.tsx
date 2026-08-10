import { Children, isValidElement, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { useId } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import Field from './Field.tsx'
import styles from './Select.module.css'

export type SelectSize = 'md' | 'lg'

/** Evento compatible con el `<select>` nativo: `e.target.value` y `e.target.name`. */
export interface SelectChangeEvent {
  target: {
    value: string
    name?: string
  }
}

export interface SelectProps {
  label?: string
  error?: string
  hint?: string
  size?: SelectSize
  id?: string
  className?: string
  name?: string
  /** Valor controlado (si se pasa, el select queda controlado). */
  value?: string | number
  /** Valor inicial para uso no controlado. */
  defaultValue?: string | number
  onChange?: (e: SelectChangeEvent) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  ariaLabel?: string
  children?: ReactNode
}

interface SelectOption {
  value: string
  label: ReactNode
  disabled: boolean
}

/** Extrae las opciones de los `<option>` hijos, igual que lo haría un `<select>`. */
function extractOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const value = (child.props as { value?: unknown }).value
    if (value === undefined || value === null) return
    options.push({
      value: String(value),
      label: (child.props as { children?: ReactNode }).children ?? String(value),
      disabled: Boolean((child.props as { disabled?: boolean }).disabled),
    })
  })
  return options
}

/** Select desplegable 100% custom (sin el `<select>` de HTML). */
export default function Select({
  label,
  error,
  hint,
  size = 'md',
  id,
  className,
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  placeholder,
  ariaLabel,
  children,
}: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  const options = extractOptions(children)
  const controlled = value !== undefined
  const [internal, setInternal] = useState<string>(() =>
    defaultValue !== undefined ? String(defaultValue) : '',
  )
  const selected = controlled ? String(value ?? '') : internal

  const [open, setOpen] = useState(false)
  const [align, setAlign] = useState<'left' | 'right'>('right')
  const [activeIndex, setActiveIndex] = useState(-1)

  const selectedIndex = options.findIndex((o) => o.value === selected)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        onBlur?.()
      }
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onBlur])

  // Cuando se abre, el foco aterriza en la opción seleccionada (o la primera).
  useEffect(() => {
    if (open && optionRefs.current[activeIndex]) {
      optionRefs.current[activeIndex]?.focus()
    }
  }, [open, activeIndex])

  const toggle = () => {
    if (disabled) return
    if (open) {
      setOpen(false)
      return
    }
    const rect = triggerRef.current?.getBoundingClientRect()
    setAlign(rect && rect.right + 220 > window.innerWidth ? 'right' : 'left')
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const choose = (opt: SelectOption) => {
    if (opt.disabled) return
    setOpen(false)
    setInternal(opt.value)
    onChange?.({ target: { value: opt.value, name } })
    onBlur?.()
  }

  const onTriggerKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!open) toggle()
    }
  }

  const onOptionKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, options.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      const opt = options[index]
      if (opt) choose(opt)
    }
  }

  const activeLabel = options.find((o) => o.value === selected)?.label
  const triggerLabel = activeLabel ?? placeholder ?? 'Selecciona…'

  const classes = [
    styles.select,
    styles[size],
    error ? styles.error : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Field htmlFor={selectId} label={label} hint={hint} error={error}>
      <div ref={rootRef} className={styles.wrapper}>
        <button
          ref={triggerRef}
          type="button"
          id={selectId}
          name={name}
          className={classes}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          onClick={toggle}
          onKeyDown={onTriggerKeyDown}
          onBlur={onBlur}
        >
          <span className={`${styles.value} ${activeLabel === undefined ? styles.placeholder : ''}`}>
            {triggerLabel}
          </span>
          <ChevronDown
            className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
            size={20}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>

        {open && (
          <div
            className={`${styles.dropdown} ${align === 'right' ? styles.alignRight : styles.alignLeft}`}
            role="listbox"
            aria-label={label ?? ariaLabel}
          >
            {options.map((opt, i) => {
              const isSelected = opt.value === selected
              const isActive = i === activeIndex
              return (
                <button
                  key={opt.value}
                  ref={(el) => {
                    optionRefs.current[i] = el
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  className={[
                    styles.option,
                    isSelected ? styles.optionSelected : '',
                    isActive ? styles.optionActive : '',
                    opt.disabled ? styles.optionDisabled : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onMouseEnter={() => setActiveIndex(i)}
                  onKeyDown={(e) => onOptionKeyDown(e, i)}
                  onClick={() => choose(opt)}
                >
                  <span className={styles.optionLabel}>{opt.label}</span>
                  {isSelected && (
                    <Check
                      className={styles.optionCheck}
                      size={18}
                      strokeWidth={2.5}
                      aria-hidden="true"
                    />
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Field>
  )
}
