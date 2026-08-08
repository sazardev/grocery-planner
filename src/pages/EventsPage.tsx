import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createEvent, listEvents } from '../lib/api'
import { ME } from '../lib/me'
import { EVENT_TYPE_LABEL, type Event, type EventType } from '../domain/event'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip, { type ChipTone } from '../shared/ui/primitives/Chip.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import EmptyState from '../shared/ui/feedback/EmptyState.tsx'
import Switch from '../shared/ui/form/Switch.tsx'
import { Card, Input, Select, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { CalendarDays } from 'lucide-react'
import styles from './EventsPage.module.css'

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABEL) as EventType[]

const kindTone: Record<EventType, ChipTone> = {
  cumpleanos: 'info',
  union: 'default',
  comida: 'default',
  celebracion: 'warning',
  reunion: 'info',
  mandado: 'default',
}

function formatDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('es', { weekday: 'short', day: 'numeric', month: 'short' })
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export default function EventsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [kind, setKind] = useState<EventType>('comida')
  const [place, setPlace] = useState('')
  const [note, setNote] = useState('')
  const [allDay, setAllDay] = useState(true)
  const [recurringYearly, setRecurringYearly] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle('Eventos · Grocery Planner')

  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: listEvents })

  const createMutation = useMutation({
    mutationFn: () =>
      createEvent({
        title: title.trim(),
        date: date.trim(),
        time: time.trim() || undefined,
        allDay,
        kind,
        place: place.trim() || undefined,
        note: note.trim() || undefined,
        recurringYearly,
        createdBy: ME,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setTitle('')
      setDate('')
      setTime('')
      setPlace('')
      setNote('')
      setAllDay(true)
      setRecurringYearly(false)
      setError(null)
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo crear el evento')),
  })

  const submit = () => {
    if (!title.trim() || !date.trim()) return
    setError(null)
    createMutation.mutate()
  }

  const events = eventsQuery.data ?? []
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => e.date >= today)
  const past = events.filter((e) => e.date < today)

  const renderList = (list: Event[]) =>
    list.map((ev) => (
      <Card
        key={ev.id}
        padding="md"
        interactive
        onClick={() => navigate(`/events/${ev.id}`)}
      >
        <Stack gap="1">
          <div className={styles.line}>
            <Text variant="item">{ev.title}</Text>
            <Chip tone={kindTone[ev.kind]}>{EVENT_TYPE_LABEL[ev.kind]}</Chip>
          </div>
          <Text as="p" variant="note" tone="secondary">
            {formatDate(ev.date)}
            {ev.time ? ` a las ${ev.time}` : ''}
            {ev.place ? ` · ${ev.place}` : ''}
          </Text>
        </Stack>
      </Card>
    ))

  return (
    <Stack gap="6">
      <header>
        <Text as="h1" variant="h1">
          Eventos
        </Text>
        <Text as="p" variant="note" tone="secondary">
          Cumpleaños, comidas y ocasiones de la familia.
        </Text>
      </header>

      <Card padding="md">
        <Stack gap="3">
          <Text as="h2" variant="section">
            Nuevo evento
          </Text>
          <Input
            label="Nombre del evento"
            placeholder="Cumple de Ana"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className={styles.rowFields}>
            <Input
              label="Fecha"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Fecha del evento"
            />
            <Input
              label="Hora (opcional)"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={allDay}
              aria-label="Hora del evento"
            />
          </div>
          <Select label="Tipo" value={kind} onChange={(e) => setKind(e.target.value as EventType)}>
            {EVENT_TYPES.map((k) => (
              <option key={k} value={k}>
                {EVENT_TYPE_LABEL[k]}
              </option>
            ))}
          </Select>
          <Input
            label="Lugar (opcional)"
            placeholder="casa de la abuela"
            value={place}
            onChange={(e) => setPlace(e.target.value)}
          />
          <Input
            label="Nota (opcional)"
            placeholder="llevar pastel"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className={styles.switchRow}>
            <Switch checked={allDay} onChange={setAllDay} label="Todo el día" />
            <Switch checked={recurringYearly} onChange={setRecurringYearly} label="Se repite cada año" />
          </div>
          {error && <Alert tone="danger">{error}</Alert>}
          <Button onClick={submit} loading={createMutation.isPending} disabled={!title.trim() || !date.trim()}>
            Crear evento
          </Button>
        </Stack>
      </Card>

      {eventsQuery.isLoading ? (
        <Skeleton variant="rect" height={160} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays size={28} strokeWidth={2} aria-hidden="true" />}
          title="Aún no hay eventos"
          description="Agrega un cumpleaños o una comida y aparece en el calendario de la familia."
        />
      ) : (
        <>
          {upcoming.length > 0 && (
            <Stack gap="2">
              <Text as="h2" variant="section">
                Próximos
              </Text>
              {renderList(upcoming)}
            </Stack>
          )}
          {past.length > 0 && (
            <Stack gap="2">
              <Text as="h2" variant="section">
                Ya pasaron
              </Text>
              {renderList(past)}
            </Stack>
          )}
        </>
      )}
    </Stack>
  )
}
