import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { ArrowLeft, CheckCircle2, Play, Plus, ShoppingCart, Trash2, XCircle } from 'lucide-react'
import {
  activateTrip,
  addItemToTrip,
  assignTrip,
  cancelTrip,
  completeTrip,
  getHome,
  getTrip,
  listItems,
  removeItemFromTrip,
} from '../lib/api'
import type { TripStatus } from '../domain/trip'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip, { type ChipTone } from '../shared/ui/primitives/Chip.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import { Card, Select, Stack } from '../shared/ui/index.ts'
import { useMeta } from '../lib/hooks/useMeta.ts'
import { invalidateCalendar } from '../lib/queryKeys.ts'
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
  const queryClient = useQueryClient()
  const [assignTarget, setAssignTarget] = useState('')
  const [itemToAdd, setItemToAdd] = useState('')

  const { data: trip, isLoading, isError, error } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => getTrip(id ?? ''),
    enabled: Boolean(id),
    refetchInterval: 15_000,
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
    invalidateCalendar(queryClient)
  }

  const assignMutation = useMutation({
    mutationFn: (member: string) => assignTrip(trip!.id, member),
    onSuccess: invalidate,
  })

  const itemsQuery = useQuery({ queryKey: ['items'], queryFn: listItems, refetchInterval: 15_000 })
  const homeQuery = useQuery({ queryKey: ['home'], queryFn: getHome, retry: false })
  const members = homeQuery.data?.members ?? []
  const itemName = (itemId: string) => itemsQuery.data?.find((i) => i.id === itemId)?.name ?? itemId

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

  const addItemMutation = useMutation({
    mutationFn: (itemId: string) => addItemToTrip(trip!.id, itemId),
    onSuccess: () => {
      setItemToAdd('')
      invalidate()
    },
  })

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => removeItemFromTrip(trip!.id, itemId),
    onSuccess: invalidate,
  })

  const goBack = useGoBack('/trips')

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
          ) : null}
          <div className={styles.assignRow}>
            <Select
              label={trip.assignedTo ? 'Pasarlo a otro' : '¿Quién lo lleva?'}
              value={assignTarget}
              onChange={(e) => setAssignTarget(e.target.value)}
            >
              <option value="">Elige un miembro…</option>
              {members.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </Select>
            <Button
              variant="secondary"
              iconLeft={<Play size={16} strokeWidth={2} />}
              onClick={() => assignTarget && assignMutation.mutate(assignTarget)}
              disabled={!assignTarget}
              loading={assignMutation.isPending}
            >
              {trip.assignedTo ? 'Retomar' : 'Asignar'}
            </Button>
          </div>
        </Stack>
      </Card>

      <Card padding="md">
        <Stack gap="3">
          <Text variant="item">
            <ShoppingCart size={18} strokeWidth={2} aria-hidden="true" /> Ítems
          </Text>
          {trip.itemIds.length === 0 ? (
            <Text as="p" variant="note" tone="secondary">
              Aún no tiene ítems. Agrega los que toca comprar desde la lista.
            </Text>
          ) : (
            <Stack gap="2">
              {trip.itemIds.map((itemId) => (
                <div key={itemId} className={styles.itemRow}>
                  <Text variant="body">{itemName(itemId)}</Text>
                  {trip.status === 'planificada' || trip.status === 'activa' ? (
                    <IconButton
                      variant="danger"
                      label={`Quitar ${itemName(itemId)} del mandado`}
                      onClick={() => removeItemMutation.mutate(itemId)}
                      disabled={removeItemMutation.isPending}
                    >
                      <Trash2 size={18} strokeWidth={2} />
                    </IconButton>
                  ) : null}
                </div>
              ))}
            </Stack>
          )}
          {trip.status === 'planificada' || trip.status === 'activa' ? (
            <div className={styles.assignRow}>
              <Select
                label="Agregar ítem de la lista"
                value={itemToAdd}
                onChange={(e) => setItemToAdd(e.target.value)}
                aria-label="Agregar ítem de la lista"
              >
                <option value="">Elige un ítem…</option>
                {(itemsQuery.data ?? [])
                  .filter((i) => !trip.itemIds.includes(i.id))
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} {i.quantity} {i.unit}
                    </option>
                  ))}
              </Select>
              <Button
                variant="secondary"
                iconLeft={<Plus size={16} strokeWidth={2} />}
                onClick={() => itemToAdd && addItemMutation.mutate(itemToAdd)}
                disabled={!itemToAdd}
                loading={addItemMutation.isPending}
              >
                Agregar
              </Button>
            </div>
          ) : null}
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
