import { useEffect, useRef, useState } from 'react'
import type { PresenceView } from '../domain/presence'
import Avatar from '../shared/ui/primitives/Avatar.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import styles from './PresenceStrip.module.css'

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return 'en línea'
  const mins = Math.max(0, Math.floor((Date.now() - then) / 60_000))
  if (mins < 1) return 'en línea'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  return `hace ${Math.floor(hours / 24)} d`
}

interface PresenceStripProps {
  users: PresenceView[]
}

/** Quiénes están conectados: solo avatares; al pasar el cursor o tocar,
 *  se abre un mini panel con el nombre de cada quien. */
export default function PresenceStrip({ users }: PresenceStripProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (users.length === 0) return null

  return (
    <div
      ref={rootRef}
      className={styles.strip}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.avatars}
        aria-expanded={open}
        aria-label={`${users.length} ${users.length === 1 ? 'persona conectada' : 'personas conectadas'}`}
        onClick={() => setOpen((o) => !o)}
      >
        {users.map((u) => (
          <span key={u.name} className={styles.avatarWrap}>
            <Avatar name={u.name} size="sm" />
            <span className={styles.dot} aria-hidden="true" />
          </span>
        ))}
      </button>

      {open && (
        <div className={styles.popover} aria-label="Personas conectadas">
          <Text as="p" variant="label" tone="tertiary" uppercase>
            Conectados
          </Text>
          <ul className={styles.list}>
            {users.map((u) => (
              <li key={u.name} className={styles.row}>
                <Avatar name={u.name} size="sm" />
                <span className={styles.who}>
                  <Text variant="item">{u.name}</Text>
                  <Text as="p" variant="note" tone="secondary">
                    {relativeTime(u.lastSeen)}
                  </Text>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
