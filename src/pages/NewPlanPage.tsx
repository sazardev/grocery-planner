import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { createPlan } from '../lib/api'
import { ME } from '../lib/me'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, DatePicker, Grid, Input, Stack, TimePicker } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import styles from './NewPlanPage.module.css'

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export default function NewPlanPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle('Nuevo plan · Grocery Planner')

  const addPlan = useMutation({
    mutationFn: ({ title, scheduledAt }: { title: string; scheduledAt: string }) =>
      createPlan({ title, scheduledAt, createdBy: ME }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
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
        <IconButton label="Volver a los planes" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <Text as="h1" variant="h1">
          Nuevo plan
        </Text>
      </header>

      <Card padding="lg">
        <Stack gap="3">
          <Text as="p" variant="note" tone="secondary">
            Elige cuándo ir a comprar; la tienda y quién lo lleva se agregan después.
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
          {error && <Alert tone="danger">{error}</Alert>}
          <div className={styles.actions}>
            <Button variant="secondary" onClick={() => navigate(-1)}>
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
