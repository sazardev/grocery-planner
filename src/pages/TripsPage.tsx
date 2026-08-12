import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createTrip, listTrips } from '../lib/api'
import { ME } from '../lib/me'
import type { ShoppingTrip, TripStatus } from '../domain/trip'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import Chip, { type ChipTone } from '../shared/ui/primitives/Chip.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import EmptyState from '../shared/ui/feedback/EmptyState.tsx'
import { Card, Input, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { invalidateCalendar } from '../lib/queryKeys.ts'
import { useFab } from '../shared/ui/navigation/fab.ts'
import ShareButton from '../shared/ui/navigation/ShareButton.tsx'
import SectionLink from '../components/SectionLink.tsx'
import { ListTree, ShoppingCart, Store } from 'lucide-react'
import styles from './TripsPage.module.css'

const tripTone: Record<TripStatus, ChipTone> = {
  planificada: 'default',
  activa: 'warning',
  completada: 'info',
  cancelada: 'danger',
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export default function TripsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  useDocumentTitle('Mandado · Grocery Planner')

  // FAB contextual "Nuevo mandado": enfoca el título del form de creación.
  useFab({
    label: 'Nuevo mandado',
    ariaLabel: 'Crear un mandado nuevo',
    onClick: () => {
      document.getElementById('trip-title')?.focus()
      document.getElementById('trip-title')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
  })

  const trips = useQuery({ queryKey: ['trips'], queryFn: listTrips, refetchInterval: 15_000 })

  const addTrip = useMutation({
    mutationFn: (t: string) => createTrip({ title: t, by: ME }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] })
      invalidateCalendar(queryClient)
      setTitle('')
      setError(null)
    },
    onError: (err) => setError(errorMessage(err, 'No se pudo crear el mandado')),
  })

  const submit = () => {
    const t = title.trim()
    if (!t) return
    setError(null)
    addTrip.mutate(t)
  }

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <Text as="h1" variant="h1">
              Mandado
            </Text>
        <Text as="p" variant="note" tone="secondary">
          La salida de compras: quién va, a qué tienda y qué llevará.
        </Text>
          </div>
          <ShareButton
            variant="ghost"
            title="Nuestro mandado · Grocery Planner"
            text="El mandado de la familia: quién va y qué lleva"
            url="/trips"
          />
        </div>
      </header>

      <Card padding="md">
        <Stack gap="3">
          <Text as="h2" variant="section">
            Nuevo mandado
          </Text>
          <Input
            id="trip-title"
            label="Título del mandado"
            placeholder="Mandado del sábado"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          {error && <Alert tone="danger">{error}</Alert>}
          <Button onClick={submit} loading={addTrip.isPending}>
            Crear mandado
          </Button>
        </Stack>
      </Card>

      {trips.isLoading ? (
        <Skeleton variant="rect" height={120} />
      ) : trips.data && trips.data.length > 0 ? (
        <Stack gap="2">
          <Text as="h2" variant="section">
            Mandados
          </Text>
          {trips.data.map((trip: ShoppingTrip) => (
            <Card
              key={trip.id}
              padding="md"
              interactive
              onClick={() => navigate(`/trips/${trip.id}`)}
            >
              <Stack gap="1">
                <div className={styles.line}>
                  <Text variant="item">{trip.title}</Text>
                  <Chip tone={tripTone[trip.status]}>{trip.status}</Chip>
                </div>
                <Text as="p" variant="note" tone="secondary">
                  {[trip.store, trip.assignedTo ? `lo lleva ${trip.assignedTo}` : null]
                    .filter(Boolean)
                    .join(' · ') || 'Sin tienda asignada'}
                </Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <EmptyState
          icon={<ShoppingCart size={28} strokeWidth={2} aria-hidden="true" />}
          title="Aún no hay mandados"
          description="Crea el primero arriba para empezar."
        />
      )}

      <Text as="h2" variant="section">
        Organiza tu mandado
      </Text>
      <SectionLink
        icon={<Store size={22} strokeWidth={2} aria-hidden="true" />}
        title="Tiendas y pasillos"
        subtitle="Dónde hace el mandado la familia"
        onClick={() => navigate('/trips/stores')}
      />
      <SectionLink
        icon={<ListTree size={22} strokeWidth={2} aria-hidden="true" />}
        title="Secciones de la lista"
        subtitle="Agrupa la lista para el mandado"
        onClick={() => navigate('/trips/sections')}
      />
    </Stack>
  )
}
