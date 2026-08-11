import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getTimeline } from '../lib/api'
import type { TimelineEntry } from '../domain/timeline'
import { Card, Chip, EmptyState, Stack, Text } from '../shared/ui/index.ts'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import {
  addDays,
  addMonths,
  addYears,
  formatDate,
  formatDateTime,
  localWindowRangeISO,
  parseISO,
  startOfMonth,
  startOfWeek,
  todayISO,
} from '../lib/dates.ts'
import { ChevronLeft, ChevronRight, History, ArrowLeft } from 'lucide-react'
import styles from './HistoryPage.module.css'

type ViewMode = 'dia' | 'semana' | 'mes' | 'anio'

export default function HistoryPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ViewMode>('semana')
  const [anchor, setAnchor] = useState(todayISO())
  useDocumentTitle('Historial de la familia · Grocery Planner')

  const { start, end } = useMemo(() => {
    if (mode === 'dia') return { start: anchor, end: anchor }
    if (mode === 'semana') {
      const s = startOfWeek(anchor)
      return { start: s, end: addDays(s, 6) }
    }
    if (mode === 'anio') {
      const y = parseISO(anchor).getFullYear()
      return { start: `${y}-01-01`, end: `${y}-12-31` }
    }
    const s = startOfMonth(anchor)
    return { start: s, end: addDays(addMonths(s, 1), -1) }
  }, [mode, anchor])

  const { data = [], isLoading } = useQuery({
    queryKey: ['timeline', start, end],
    queryFn: () => {
      const range = localWindowRangeISO(start, end)
      return getTimeline(range.start, range.end)
    },
    refetchInterval: 20_000,
  })

  const grouped = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>()
    for (const e of data) {
      const day = e.at.slice(0, 10)
      const list = map.get(day) ?? []
      list.push(e)
      map.set(day, list)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [data])

  const step = () => {
    if (mode === 'dia') setAnchor(addDays(anchor, 1))
    else if (mode === 'semana') setAnchor(addDays(anchor, 7))
    else if (mode === 'mes') setAnchor(addMonths(anchor, 1))
    else setAnchor(addYears(anchor, 1))
  }
  const back = () => {
    if (mode === 'dia') setAnchor(addDays(anchor, -1))
    else if (mode === 'semana') setAnchor(addDays(anchor, -7))
    else if (mode === 'mes') setAnchor(addMonths(anchor, -1))
    else setAnchor(addYears(anchor, -1))
  }

  const title =
    mode === 'dia'
      ? formatDate(anchor)
      : mode === 'semana'
        ? `${formatDate(start)} – ${formatDate(end)}`
        : mode === 'mes'
          ? parseISO(anchor).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
          : `Año ${parseISO(anchor).getFullYear()}`

  const goBack = () => navigate('/family')

  return (
    <Stack gap="4">
      <header>
        <div className={styles.headerRow}>
          <IconButton label="Volver a la familia" onClick={goBack}>
            <ArrowLeft size={22} strokeWidth={2} />
          </IconButton>
          <Text as="h1" variant="h1">
            Historial
          </Text>
        </div>
        <Text as="p" variant="note" tone="secondary">
          Todo lo que pasó en casa: compras, mandados, eventos y cambios.
        </Text>
        <div className={styles.controls}>
          <button type="button" className={styles.navBtn} onClick={back} aria-label="Anterior">
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <Text as="span" variant="section" className={styles.rangeTitle}>
            {title}
          </Text>
          <button type="button" className={styles.navBtn} onClick={step} aria-label="Siguiente">
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <div className={styles.modes} role="tablist" aria-label="Ventana del historial">
          {(['dia', 'semana', 'mes', 'anio'] as ViewMode[]).map((m) => (
            <Chip key={m} tone={mode === m ? 'default' : 'muted'} onClick={() => setMode(m)}>
              {m === 'dia' ? 'Día' : m === 'semana' ? 'Semana' : m === 'mes' ? 'Mes' : 'Año'}
            </Chip>
          ))}
        </div>
      </header>

      {isLoading ? (
        <Stack gap="3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} padding="md">
              <Text tone="tertiary">…</Text>
            </Card>
          ))}
        </Stack>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<History size={28} strokeWidth={2} aria-hidden="true" />}
          title="Nada por aquí"
          description="Las compras, mandados y comentarios de esta ventana aparecerán aquí."
        />
      ) : (
        grouped.map(([day, entries]) => (
          <Stack key={day} gap="1">
            <Text as="h2" variant="section" className={styles.dayLabel}>
              {formatDate(day)}
            </Text>
            <Card padding="sm">
              <Stack gap="2">
                {entries.map((e, i) => (
                  <div key={`${day}-${i}`} className={styles.row}>
                    <span className={styles.dot} aria-hidden="true" />
                    <Stack gap="0" className={styles.rowBody}>
                      <Text variant="body">{e.title}</Text>
                      <Text variant="note" tone="secondary">
                        {formatDateTime(e.at)} · {e.by}
                      </Text>
                    </Stack>
                  </div>
                ))}
              </Stack>
            </Card>
          </Stack>
        ))
      )}
    </Stack>
  )
}
