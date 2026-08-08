import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Play, ShoppingCart, XCircle } from 'lucide-react'
import { activateTrip, assignTrip, cancelTrip, completeTrip, getTrip } from '../lib/api'
import { ME } from '../lib/me'
import type { TripStatus } from '../domain/trip'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip, { type ChipTone } from '../shared/ui/primitives/Chip.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import { useMeta } from '../lib/hooks/useMeta.ts'
import ShareButton from '../shared/ui/navigation/ShareButton.tsx'
import styles from './TripDetailPage.module.css'

const tripTone: Record<TripStatus, ChipTone> = {
  planificada: 'default',
  activa: 'warning',
  completada: 'info',
  cancelada: 'danger',
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: trip, isLoading, isError, error } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => getTrip(id ?? ''),
    enabled: Boolean(id),
  })

  useMeta({
    title: trip ? `${trip.title} · Grocery Planner` : 'Mandado · Grocery Planner',
    description: trip
      ? `Mandado: ${trip.title} (${trip.status})${trip.store ? ` en ${trip.store}` : ''}.`
      : 'Detalle del mandado de la familia.',
    path: trip ? `/trips/${trip.id}` : undefined,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['trips'] })
    queryClient.invalidateQueries({ queryKey: ['trip', id] })
  }

  const assignMutation = useMutation({
    mutationFn: () => assignTrip(trip!.id, ME),
    onSuccess: invalidate,
  })

  const activateMutation = useMutation({
    mutationFn: () => activateTrip(trip!.id),
    onSuccess: invalidate,
  })

  const completeMutation = useMutation({
    mutationFn: () => completeTrip(trip!.id),
    onSuccess: invalidate,
  })

  const cancelMutation = useMutation({
    mutationFn: () => cancelTrip(trip!.id),
    onSuccess: invalidate,
  })

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/trips')
  }

  if (isLoading || !trip) {
    return (
      <Stack gap="4">
        <Skeleton variant="rect" height={100} />
        <Skeleton variant="rect" height={160} />
      </Stack>
    )
  }

  if (isError) {
    return (
      <Stack gap="4">
        <Alert tone="danger" title="No se pudo cargar el mandado.">
          {error instanceof Error ? error.message : 'Intenta de nuevo.'}
        </Alert>
        <Button variant="secondary" onClick={goBack}>
          Volver a los mandados
        </Button>
      </Stack>
    )
  }

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver a los mandados" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <div className={styles.titleBlock}>
          <Text as="h1" variant="h1">
            {trip.title}
          </Text>
          <Chip tone={tripTone[trip.status]}>{trip.status}</Chip>
        </div>
        <div className={styles.headerSpacer} />
        <ShareButton
          title={`${trip.title} · Grocery Planner`}
          text={`Mandado: ${trip.title} (${trip.status})`}
          url={`/trips/${trip.id}`}
        />
      </header>

      <Card padding="lg">
        <Stack gap="2">
          <Text variant="item">Mandado</Text>
          <Text as="p" variant="note" tone="secondary">
            {[trip.store, trip.assignedTo ? `lo lleva ${trip.assignedTo}` : null]
              .filter(Boolean)
              .join(' · ') || 'Sin tienda asignada'}
          </Text>
          {trip.assignedTo ? (
            <Text as="p" variant="note" tone="secondary">
              Creado por {trip.createdBy} · lo lleva {trip.assignedTo}
            </Text>
          ) : (
            <Button
              variant="secondary"
              iconLeft={<Play size={16} strokeWidth={2} />}
              onClick={() => assignMutation.mutate()}
              loading={assignMutation.isPending}
            >
              Me toca a mí
            </Button>
          )}
        </Stack>
      </Card>

      <Card padding="md">
        <Stack gap="2">
          <Text variant="item">
            <ShoppingCart size={18} strokeWidth={2} aria-hidden="true" /> Ítems
          </Text>
          {trip.itemIds.length === 0 ? (
            <Text as="p" variant="note" tone="secondary">
              Aún no tiene ítems. Los ítems se agregan desde la lista de compras.
            </Text>
          ) : (
            trip.itemIds.map((itemId) => (
              <Text key={itemId} variant="body">
                {itemId}
              </Text>
            ))
          )}
        </Stack>
      </Card>

      <Stack gap="2">
        {trip.status === 'planificada' && (
          <Button
            iconLeft={<Play size={18} strokeWidth={2} />}
            onClick={() => activateMutation.mutate()}
            loading={activateMutation.isPending}
            full
          >
            Empezar mandado
          </Button>
        )}
        {trip.status === 'activa' && (
          <Button
            iconLeft={<CheckCircle2 size={18} strokeWidth={2} />}
            onClick={() => completeMutation.mutate()}
            loading={completeMutation.isPending}
            full
          >
            Marcar como completado
          </Button>
        )}
        {trip.status !== 'completada' && trip.status !== 'cancelada' && (
          <Button
            variant="danger"
            iconLeft={<XCircle size={18} strokeWidth={2} />}
            onClick={() => cancelMutation.mutate()}
            loading={cancelMutation.isPending}
            full
          >
            Cancelar mandado
          </Button>
        )}
      </Stack>
    </Stack>
  )
}
