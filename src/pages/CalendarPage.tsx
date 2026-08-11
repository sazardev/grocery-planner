import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listEventsInRange, listPlans, listTrips } from '../lib/api'
import { Card, Chip, Stack, Text } from '../shared/ui/index.ts'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import {
  addDays,
  addMonths,
  addYears,
  formatDate,
  formatDateLong,
  parseISO,
  startOfMonth,
  startOfWeek,
  toISODate,
  todayISO,
} from '../lib/dates.ts'
import { ChevronLeft, ChevronRight, CalendarDays, ArrowLeft, Plus } from 'lucide-react'
import styles from './CalendarPage.module.css'

type ViewMode = 'dia' | 'semana' | 'mes' | 'anio'

export interface CalendarItem {
  id: string
  kind: 'event' | 'plan' | 'trip'
  title: string
  date: string
  time?: string
  href: string
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function CalendarPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<ViewMode>('mes')
  const [anchor, setAnchor] = useState(todayISO())
  useDocumentTitle('Calendario familiar · Grocery Planner')

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

  const eventsQuery = useQuery({
    queryKey: ['calendar', 'events', start, end],
    queryFn: () => listEventsInRange(start, end),
    refetchInterval: 15_000,
  })
  const plansQuery = useQuery({ queryKey: ['calendar', 'plans'], queryFn: listPlans, refetchInterval: 15_000 })
  const tripsQuery = useQuery({ queryKey: ['calendar', 'trips'], queryFn: listTrips, refetchInterval: 15_000 })

  const items = useMemo<CalendarItem[]>(() => {
    const out: CalendarItem[] = []
    for (const e of eventsQuery.data ?? []) {
      out.push({
        id: e.id,
        kind: 'event',
        title: e.title,
        date: e.date,
        time: e.time,
        href: `/events/${e.id}`,
      })
    }
    for (const p of plansQuery.data ?? []) {
      if (p.scheduledAt >= start && p.scheduledAt.slice(0, 10) <= end) {
        out.push({
          id: p.id,
          kind: 'plan',
          title: p.title,
          date: p.scheduledAt.slice(0, 10),
          time: p.scheduledAt.slice(11, 16),
          href: `/plans/${p.id}`,
        })
      }
    }
    for (const t of tripsQuery.data ?? []) {
      const date = t.createdAt.slice(0, 10)
      if (date >= start && date <= end) {
        out.push({ id: t.id, kind: 'trip', title: t.title, date, href: `/trips/${t.id}` })
      }
    }
    out.sort((a, b) => a.date.localeCompare(b.date))
    return out
  }, [eventsQuery.data, plansQuery.data, tripsQuery.data, start, end])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const it of items) {
      const list = map.get(it.date) ?? []
      list.push(it)
      map.set(it.date, list)
    }
    return map
  }, [items])

  const goBack = () => navigate('/family')

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
      ? formatDateLong(anchor)
      : mode === 'semana'
        ? `${formatDate(start)} – ${formatDate(end)}`
        : mode === 'mes'
          ? parseISO(anchor).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
          : `Año ${parseISO(anchor).getFullYear()}`

  const today = todayISO()

  const openDay = (day: string) => {
    setAnchor(day)
    setMode('dia')
  }

  return (
    <Stack gap="4">
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <IconButton label="Volver a la familia" onClick={goBack}>
            <ArrowLeft size={22} strokeWidth={2} />
          </IconButton>
          <Text as="h1" variant="h1">
            Calendario familiar
          </Text>
          <div className={styles.headerSpacer} />
          <Button size="sm" onClick={() => navigate(`/events?date=${anchor}`)}>
            <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> Evento
          </Button>
        </div>
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
          <Chip tone="default" onClick={() => setAnchor(today)}>
            Hoy
          </Chip>
        </div>
        <div className={styles.modes} role="tablist" aria-label="Vista del calendario">
          {(['dia', 'semana', 'mes', 'anio'] as ViewMode[]).map((m) => (
            <Chip
              key={m}
              tone={mode === m ? 'default' : 'muted'}
              onClick={() => setMode(m)}
            >
              {m === 'dia' ? 'Día' : m === 'semana' ? 'Semana' : m === 'mes' ? 'Mes' : 'Año'}
            </Chip>
          ))}
        </div>
        <div className={styles.modes}>
          <Chip tone="default" onClick={() => navigate('/events')}>
            Ver eventos
          </Chip>
          <Chip tone="default" onClick={() => navigate('/plans')}>
            Ver planes
          </Chip>
        </div>
      </header>

      {mode === 'mes' && <MonthGrid anchor={anchor} byDay={byDay} today={today} onDay={openDay} />}
      {mode === 'semana' && (
        <WeekGrid start={start} byDay={byDay} today={today} onDay={openDay} />
      )}
      {mode === 'anio' && <YearGrid anchor={anchor} byDay={byDay} onDay={openDay} />}
      {mode === 'dia' && (
        <DayList
          items={byDay.get(anchor) ?? []}
          onOpen={navigate}
          onAdd={() => navigate(`/events?date=${anchor}`)}
        />
      )}
    </Stack>
  )
}

function CalendarChip({ item }: { item: CalendarItem }) {
  return (
    <span className={styles.itemChip} data-kind={item.kind}>
      {item.kind === 'event' ? '🎉' : item.kind === 'plan' ? '🛒' : '🧺'}{' '}
      {item.title}
    </span>
  )
}

function MonthGrid({
  anchor,
  byDay,
  today,
  onDay,
}: {
  anchor: string
  byDay: Map<string, CalendarItem[]>
  today: string
  onDay: (d: string) => void
}) {
  const first = startOfMonth(anchor)
  const d = parseISO(first)
  const offset = (d.getDay() + 6) % 7
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  const cells: (string | null)[] = Array.from({ length: offset }, () => null)
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push(toISODate(new Date(d.getFullYear(), d.getMonth(), i)))
  }

  return (
    <div>
      <div className={styles.weekRow}>
        {WEEKDAYS.map((w) => (
          <Text key={w} variant="label" uppercase tone="secondary" align="center">
            {w}
          </Text>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {cells.map((date, i) =>
          date === null ? (
            <div key={`e${i}`} className={styles.dayCell} />
          ) : (
            <button
              key={date}
              type="button"
              className={`${styles.dayCell} ${date === today ? styles.today : ''}`}
              onClick={() => onDay(date)}
            >
              <Text variant="note" className={styles.dayNum}>
                {parseISO(date).getDate()}
              </Text>
              <div className={styles.cellItems}>
                {(byDay.get(date) ?? []).slice(0, 2).map((it) => (
                  <CalendarChip key={`${it.kind}-${it.id}`} item={it} />
                ))}
                {(byDay.get(date) ?? []).length > 2 && (
                  <Text variant="note" tone="secondary">
                    +{(byDay.get(date) ?? []).length - 2} más
                  </Text>
                )}
              </div>
            </button>
          ),
        )}
      </div>
    </div>
  )
}

function WeekGrid({
  start,
  byDay,
  today,
  onDay,
}: {
  start: string
  byDay: Map<string, CalendarItem[]>
  today: string
  onDay: (d: string) => void
}) {
  return (
    <div className={styles.weekGrid}>
      {Array.from({ length: 7 }, (_, i) => {
        const date = addDays(start, i)
        return (
          <button
            key={date}
            type="button"
            className={`${styles.weekCol} ${date === today ? styles.today : ''}`}
            onClick={() => onDay(date)}
          >
            <Text variant="label" uppercase tone="secondary">
              {parseISO(date).toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' })}
            </Text>
            <Stack gap="1" className={styles.cellItems}>
              {(byDay.get(date) ?? []).map((it) => (
                <CalendarChip key={`${it.kind}-${it.id}`} item={it} />
              ))}
            </Stack>
          </button>
        )
      })}
    </div>
  )
}

function YearGrid({
  anchor,
  byDay,
  onDay,
}: {
  anchor: string
  byDay: Map<string, CalendarItem[]>
  onDay: (d: string) => void
}) {
  const year = parseISO(anchor).getFullYear()
  return (
    <div className={styles.yearGrid}>
      {Array.from({ length: 12 }, (_, m) => {
        const monthStart = `${year}-${String(m + 1).padStart(2, '0')}-01`
        const count = Array.from(byDay.entries()).filter(
          ([date]) => date.startsWith(`${year}-${String(m + 1).padStart(2, '0')}`),
        ).reduce((acc, [, items]) => acc + items.length, 0)
        return (
          <button
            key={monthStart}
            type="button"
            className={styles.yearCard}
            onClick={() => onDay(monthStart)}
          >
            <Text variant="section">
              {new Date(year, m, 1).toLocaleDateString('es-MX', { month: 'long' })}
            </Text>
            <Text variant="note" tone="secondary">
              {count === 0 ? 'Sin planes' : `${count} ${count === 1 ? 'plan' : 'planes'}`}
            </Text>
          </button>
        )
      })}
    </div>
  )
}

function DayList({
  items,
  onOpen,
  onAdd,
}: {
  items: CalendarItem[]
  onOpen: (to: string) => void
  onAdd: () => void
}) {
  return (
    <Stack gap="2">
      {items.length === 0 ? (
        <Card padding="lg">
          <Stack gap="2" align="center">
            <CalendarDays size={28} strokeWidth={2} aria-hidden="true" />
            <Text tone="secondary">Nada planeado este día.</Text>
            <Button variant="secondary" onClick={onAdd}>
              <Plus size={16} aria-hidden="true" /> Agregar evento
            </Button>
          </Stack>
        </Card>
      ) : (
        items.map((it) => (
          <Card key={`${it.kind}-${it.id}`} interactive padding="md" onClick={() => onOpen(it.href)}>
            <div className={styles.dayRow}>
              <span className={styles.dot} data-kind={it.kind} aria-hidden="true" />
              <Text weight="medium">{it.title}</Text>
              {it.time && <Chip tone="muted">{it.time}</Chip>}
            </div>
          </Card>
        ))
      )}
    </Stack>
  )
}
