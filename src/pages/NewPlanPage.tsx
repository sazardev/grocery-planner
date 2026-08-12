import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createPlan, getHome, getRules } from '../lib/api'
import { ME } from '../lib/me'
import { RECURRENCE_LABEL, type Recurrence } from '../domain/plan'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, DatePicker, Grid, Input, Select, Stack, Textarea, TimePicker } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { invalidateCalendar } from '../lib/queryKeys.ts'
import styles from './NewPlanPage.module.css'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

const RECURRENCES = Object.keys(RECURRENCE_LABEL) as Recurrence[]

export default function NewPlanPage() {
  const navigate = useNavigate()
  const goBack = useGoBack('/plans')
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const preselect = searchParams.get('date') ?? ''
  const [title, setTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState(preselect)
  const [scheduledTime, setScheduledTime] = useState('')
  const [store, setStore] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [recurrence, setRecurrence] = useState<Recurrence>('ninguna')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle('Nuevo plan · Grocery Planner')

  const rulesQuery = useQuery({ queryKey: ['rules'], queryFn: getRules, retry: false })
  const homeQuery = useQuery({ queryKey: ['home'], queryFn: getHome, retry: false })
  const stores = rulesQuery.data?.stores ?? []
  const members = homeQuery.data?.members ?? []

  const addPlan = useMutation({
    mutationFn: ({ title, scheduledAt }: { title: string; scheduledAt: string }) =>
      createPlan({
        title,
        scheduledAt,
        store: store.trim() || undefined,
        assignedTo: assignedTo || undefined,
        note: note.trim() || undefined,
        recurrence,
        createdBy: ME,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      invalidateCalendar(queryClient)
      navigate('/plans', { replace: true })
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo crear el plan')),
  })

  const submit = () => {
    const t = title.trim()
    const date = scheduledDate.trim()
    const time = scheduledTime.trim()
    if (!t || !date || !time) return
    setError(null)
    addPlan.mutate({ title: t, scheduledAt: `${date}T${time}` })
  }

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver a los planes" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <Text as="h1" variant="h1">
          Nuevo plan
        </Text>
      </header>

      <Card padding="lg">
        <Stack gap="3">
          <Text as="p" variant="note" tone="secondary">
            Cuándo van a comprar, a qué tienda y quién lo lleva (SPEC §7.1).
          </Text>
          <Input
            label="Título del plan"
            placeholder="Mandado grande del sábado"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Título del plan"
          />
          <Grid cols={1} colsMd={2} colsLg={2} gap="3">
            <DatePicker
              label="Cuándo"
              value={scheduledDate}
              onChange={setScheduledDate}
              min={new Date().toISOString().slice(0, 10)}
              hint="Elige el día para ir a comprar"
            />
            <TimePicker
              label="Hora"
              value={scheduledTime}
              onChange={setScheduledTime}
              hint="Elige a qué hora ir a comprar"
            />
          </Grid>
          <Select label="Tienda (opcional)" value={store} onChange={(e) => setStore(e.target.value)}>
            <option value="">Sin tienda definida</option>
            {stores.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
          <Select label="Lo lleva (opcional)" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Sin asignar</option>
            {members.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select label="Se repite" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            {RECURRENCES.map((r) => (
              <option key={r} value={r}>
                {RECURRENCE_LABEL[r]}
              </option>
            ))}
          </Select>
          <Textarea
            label="Nota (opcional)"
            placeholder="Llevar bolsas, comparar precios…"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={goBack}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={addPlan.isPending}>
              Crear plan
            </Button>
          </div>
        </Stack>
      </Card>
    </Stack>
  )
}
