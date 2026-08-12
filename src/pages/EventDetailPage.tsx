import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { ArrowLeft, CalendarClock, Trash2, Plus, Pencil } from 'lucide-react'
import {
  addItemToEvent,
  deleteEvent,
  discardEventList,
  getEvent,
  listItems,
  mergeEventListToHome,
  removeItemFromEvent,
  updateEvent,
} from '../lib/api'
import { EVENT_TYPE_LABEL, type EventType } from '../domain/event'
import { ME } from '../lib/me'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Chip, { type ChipTone } from '../shared/ui/primitives/Chip.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import Field from '../shared/ui/form/Field.tsx'
import Input from '../shared/ui/form/Input.tsx'
import Checkbox from '../shared/ui/primitives/Checkbox.tsx'
import { Card, Select, Stack } from '../shared/ui/index.ts'
import { useMeta } from '../lib/hooks/useMeta.ts'
import { invalidateCalendar } from '../lib/queryKeys.ts'
import ShareButton from '../shared/ui/navigation/ShareButton.tsx'
import styles from './EventDetailPage.module.css'

const kindTone: Record<string, ChipTone> = {
  cumpleanos: 'info',
  celebracion: 'warning',
  reunion: 'info',
}

const EVENT_TYPES: EventType[] = ['cumpleanos', 'union', 'comida', 'celebracion', 'reunion', 'mandado']
const REMINDERS = [
  { value: '', label: 'Sin recordatorio' },
  { value: '60', label: '1 hora antes' },
  { value: '180', label: '3 horas antes' },
  { value: '1440', label: '1 día antes' },
  { value: '10080', label: '1 semana antes' },
]

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pickItem, setPickItem] = useState('')
  const [error, setError] = useState<string | null>(null)

  const eventQuery = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: 15_000,
  })
  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: listItems, refetchInterval: 15_000 })

  const event = eventQuery.data

  // Estado del formulario de edición.
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editKind, setEditKind] = useState<EventType>('comida')
  const [editPlace, setEditPlace] = useState('')
  const [editParticipants, setEditParticipants] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editRecurring, setEditRecurring] = useState(false)
  const [editReminder, setEditReminder] = useState('')

  const beginEdit = () => {
    if (!event) return
    setEditTitle(event.title)
    setEditDate(event.date)
    setEditTime(event.time ?? '')
    setEditKind(event.kind)
    setEditPlace(event.place ?? '')
    setEditParticipants(event.participants.join(', '))
    setEditNote(event.note ?? '')
    setEditRecurring(event.recurringYearly)
    setEditReminder(event.reminderMinutes ? String(event.reminderMinutes) : '')
    setEditing(true)
  }

  const editMutation = useMutation({
    mutationFn: () =>
      updateEvent(event!.id, {
        by: ME,
        title: editTitle.trim(),
        date: editDate,
        time: editTime || undefined,
        allDay: !editTime,
        kind: editKind,
        place: editPlace || undefined,
        participants: editParticipants.split(',').map((p) => p.trim()).filter(Boolean),
        note: editNote || undefined,
        recurringYearly: editRecurring,
        reminderMinutes: editReminder ? Number(editReminder) : null,
      }),
    onSuccess: () => {
      invalidate()
      setEditing(false)
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'No se pudo guardar'),
  })

  useMeta({
    title: event ? `${event.title} · Grocery Planner` : 'Evento · Grocery Planner',
    description: event
      ? `${EVENT_TYPE_LABEL[event.kind]}: ${event.title} el ${event.date}.`
      : 'Un evento de la familia.',
    path: event ? `/events/${event.id}` : undefined,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['event', id] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['items'] })
    queryClient.invalidateQueries({ queryKey: ['mine'] })
    queryClient.invalidateQueries({ queryKey: ['kiosk', 'items'] })
    invalidateCalendar(queryClient)
  }

  const addMutation = useMutation({
    mutationFn: (itemId: string) => addItemToEvent(event!.id, itemId),
    onSuccess: () => {
      invalidate()
      setPickItem('')
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'No se pudo agregar'),
  })

  const removeMutation = useMutation({
    mutationFn: (itemId: string) => removeItemFromEvent(event!.id, itemId),
    onSuccess: invalidate,
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(event!.id, ME),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      navigate('/events')
    },
  })
  const mergeMutation = useMutation({
    mutationFn: () => mergeEventListToHome(event!.id),
    onSuccess: () => {
      invalidate()
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'No se pudo fusionar'),
  })

  const discardMutation = useMutation({
    mutationFn: () => discardEventList(event!.id),
    onSuccess: () => {
      invalidate()
      setError(null)
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'No se pudo descartar la lista'),
  })

  const goBack = useGoBack('/events')

  if (eventQuery.isLoading || !event) {
    return (
      <Stack gap="4">
        <Skeleton variant="rect" height={100} />
        <Skeleton variant="rect" height={160} />
      </Stack>
    )
  }

  if (eventQuery.isError) {
    return (
      <Stack gap="4">
        <Alert tone="danger" title="No se pudo cargar el evento." />
        <Button variant="secondary" onClick={goBack}>
          Volver a los eventos
        </Button>
      </Stack>
    )
  }

  const items = itemsQuery.data ?? []
  const nameOf = (itemId: string) => items.find((i) => i.id === itemId)?.name ?? itemId
  const available = items.filter((i) => !event.itemIds.includes(i.id))

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver a los eventos" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <div className={styles.titleBlock}>
          <Text as="h1" variant="h1">
            {event.title}
          </Text>
          <Chip tone={kindTone[event.kind] ?? 'default'}>{EVENT_TYPE_LABEL[event.kind]}</Chip>
        </div>
        <div className={styles.spacer} />
        <Button variant="secondary" size="sm" onClick={beginEdit} aria-label="Editar evento">
          <Pencil size={16} strokeWidth={2} aria-hidden="true" /> Editar
        </Button>
        <ShareButton
          title={`${event.title} · Grocery Planner`}
          text={`${EVENT_TYPE_LABEL[event.kind]}: ${event.title} el ${event.date}`}
          url={`/events/${event.id}`}
        />
      </header>

      {error && <Alert tone="danger">{error}</Alert>}

      {editing ? (
        <Card padding="lg">
          <Stack gap="3">
            <Text as="h2" variant="section">
              Editar evento
            </Text>
            <Field label="Nombre">
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} aria-label="Nombre del evento" />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} aria-label="Fecha del evento" />
            </Field>
            <Field label="Hora (vacío = todo el día)">
              <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} aria-label="Hora del evento" />
            </Field>
            <Select label="Tipo" value={editKind} onChange={(e) => setEditKind(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EVENT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
            <Field label="Lugar (opcional)">
              <Input value={editPlace} onChange={(e) => setEditPlace(e.target.value)} aria-label="Lugar del evento" />
            </Field>
            <Field label="Participantes (separados por coma)">
              <Input value={editParticipants} onChange={(e) => setEditParticipants(e.target.value)} placeholder="Papá, Ana, Abuela" aria-label="Participantes del evento" />
            </Field>
            <Field label="Nota (opcional)">
              <Input value={editNote} onChange={(e) => setEditNote(e.target.value)} aria-label="Nota del evento" />
            </Field>
            <Select label="Recordatorio" value={editReminder} onChange={(e) => setEditReminder(e.target.value)}>
              {REMINDERS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Checkbox
              checked={editRecurring}
              onChange={() => setEditRecurring((v) => !v)}
              label="Se repite cada año"
            />
            <div className={styles.line}>
              <Button variant="secondary" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
              <Button onClick={() => editMutation.mutate()} loading={editMutation.isPending}>
                Guardar cambios
              </Button>
            </div>
          </Stack>
        </Card>
      ) : (
        <Card padding="lg">
          <Stack gap="2">
            <Text variant="item">
              <CalendarClock size={18} strokeWidth={2} aria-hidden="true" /> {event.date}
              {event.time ? ` a las ${event.time}` : ''} · {event.allDay ? 'todo el día' : 'con hora'}
            </Text>
            {event.place && (
              <Text as="p" variant="note" tone="secondary">
                Lugar: {event.place}
              </Text>
            )}
            {event.note && <Text as="p" variant="body">{event.note}</Text>}
            {event.recurringYearly && (
              <Text as="p" variant="note" tone="secondary">
                Se repite cada año
              </Text>
            )}
            {event.participants.length > 0 && (
              <Text as="p" variant="note" tone="secondary">
                Participan: {event.participants.join(', ')}
              </Text>
            )}
          </Stack>
        </Card>
      )}

      <Card padding="md">
        <Stack gap="3">
          <Text as="h2" variant="section">
            Lista del evento
          </Text>
          {event.itemIds.length === 0 ? (
            <Text as="p" variant="note" tone="secondary">
              Aún sin ítems. Agrega lo que haga falta para esta ocasión.
            </Text>
          ) : (
            event.itemIds.map((itemId) => (
              <div key={itemId} className={styles.line}>
                <Text variant="item">{nameOf(itemId)}</Text>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeMutation.mutate(itemId)}
                  disabled={removeMutation.isPending}
                >
                  Quitar
                </Button>
              </div>
            ))
          )}
          {available.length > 0 && (
            <div className={styles.line}>
              <Select
                aria-label="Agregar ítem de la lista"
                value={pickItem}
                onChange={(e) => setPickItem(e.target.value)}
              >
                <option value="">Elegir de la lista…</option>
                {available.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
              <Button
                iconLeft={<Plus size={16} strokeWidth={2} />}
                onClick={() => pickItem && addMutation.mutate(pickItem)}
                disabled={!pickItem}
              >
                Agregar
              </Button>
            </div>
          )}
        </Stack>
      </Card>

      {event.itemIds.length > 0 && (
        <Stack gap="2">
          <Text as="h2" variant="section">
            Al terminar la ocasión
          </Text>
          <Button
            variant="secondary"
            onClick={() => mergeMutation.mutate()}
            loading={mergeMutation.isPending}
            full
          >
            Fusionar a la lista de la casa
          </Button>
          <Button
            variant="ghost"
            onClick={() => discardMutation.mutate()}
            loading={discardMutation.isPending}
            full
          >
            Descartar estos ítems
          </Button>
        </Stack>
      )}

      <Button
        variant="danger"
        full
        onClick={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      >
        <Trash2 size={18} strokeWidth={2} /> Borrar evento
      </Button>
    </Stack>
  )
}
