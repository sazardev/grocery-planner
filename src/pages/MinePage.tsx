import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { applyItemFallback, cancelItem, changeItemStatus, confirmTripReceived, listTrips, queryItems } from '../lib/api'
import { ME } from '../lib/me'
import type { GroceryItem } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import ItemRow from '../shared/ui/data-display/ItemRow.tsx'
import ItemCard from '../shared/ui/data-display/ItemCard.tsx'
import List from '../shared/ui/data-display/List.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import ProgressBar from '../shared/ui/primitives/ProgressBar.tsx'
import ViewToggle from '../components/ViewToggle.tsx'
import { loadViewMode, saveViewMode } from '../lib/viewMode.ts'
import type { ListViewMode } from '../lib/viewMode.ts'
import { Button, Card, EmptyState, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { Ban, PackageCheck, ShoppingBag } from 'lucide-react'
import styles from './MinePage.module.css'

const MINE_KEY = ['mine']

export default function MinePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState<ListViewMode>(loadViewMode)
  useEffect(() => saveViewMode(view), [view])
  useDocumentTitle('Lo mío · Grocery Planner')

  const itemsQuery = useQuery({
    queryKey: MINE_KEY,
    queryFn: () => queryItems({ assignedTo: ME, sort: 'priority' }),
    refetchInterval: 10_000,
  })
  const tripsQuery = useQuery({ queryKey: ['trips'], queryFn: listTrips, refetchInterval: 15_000 })

  const items = itemsQuery.data ?? []
  const trips = tripsQuery.data ?? []
  const pending = items.filter((i) => i.status === 'falta' || i.status === 'pedido')
  const carrying = items.filter((i) => i.status === 'llevo')
  const completedNotReceived = trips.filter(
    (t) => t.status === 'completada' && !t.receivedAt,
  )

  const invalidate = () => queryClient.invalidateQueries({ queryKey: MINE_KEY })

  const toggleMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: GroceryItem['status'] }) =>
      changeItemStatus(id, to, ME),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  const receiveMutation = useMutation({
    mutationFn: (id: string) => confirmTripReceived(id, ME),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips'] }),
  })

  const grouped = useMemo(() => {
    const map = new Map<string, GroceryItem[]>()
    for (const it of itemsQuery.data ?? []) {
      const key = it.store ?? 'Sin tienda'
      const list = map.get(key) ?? []
      list.push(it)
      map.set(key, list)
    }
    return Array.from(map.entries())
  }, [itemsQuery.data])

  return (
    <Stack gap="6">
      <header>
        <div className={styles.headerRow}>
          <div>
            <Text as="h1" variant="h1">
              Lo mío
            </Text>
            <Text as="p" variant="note" tone="secondary">
              Todo lo que te toca comprar hoy, agrupado por tienda.
            </Text>
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </header>

      {items.length > 0 && (
        <Card padding="md">
          <Stack gap="2">
            <Text variant="section">Llevas {carrying.length} de {items.length}</Text>
            <ProgressBar value={carrying.length} max={items.length} showValue label="Progreso del mandado" />
          </Stack>
        </Card>
      )}

      {completedNotReceived.length > 0 && (
        <Card padding="md">
          <Stack gap="3">
            <Text variant="section">
              <PackageCheck size={18} strokeWidth={2} aria-hidden="true" /> Mandados por recibir
            </Text>
            {completedNotReceived.map((t) => (
              <div key={t.id} className={styles.receiveRow}>
                <div className={styles.receiveInfo}>
                  <Text weight="medium">{t.title}</Text>
                  <Text variant="note" tone="secondary">
                    Lo hizo {t.assignedTo ?? t.createdBy}
                  </Text>
                </div>
                <Button
                  size="sm"
                  onClick={() => receiveMutation.mutate(t.id)}
                  loading={receiveMutation.isPending}
                >
                  Recibido
                </Button>
              </div>
            ))}
          </Stack>
        </Card>
      )}

      {itemsQuery.isLoading ? (
        <List gap="3">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <Skeleton variant="rect" height={72} />
            </li>
          ))}
        </List>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={28} strokeWidth={2} aria-hidden="true" />}
          title="Nada asignado a ti"
          description="Cuando alguien te asigne ítems o un mandado, aparecerán aquí."
        />
      ) : (
        grouped.map(([store, list]) => (
          <Stack key={store} gap="2">
            <div className={styles.storeHeader}>
              <Text as="h2" variant="section">
                {store}
              </Text>
              <Chip tone="default">{list.length}</Chip>
            </div>
            {view === 'grid' ? (
              <div className={styles.itemGrid}>
                {list.map((item) => (
                  <ItemCard
                    key={item.id}
                    name={item.name}
                    quantity={item.quantity}
                    unit={item.unit}
                    status={item.status}
                    urgent={item.priority === 'urgente'}
                    requestedBy={item.requestedBy}
                    assignedTo={item.assignedTo}
                    checked={item.status === 'llevo'}
                    onToggle={() =>
                      toggleMutation.mutate({
                        id: item.id,
                        to: item.status === 'llevo' ? 'falta' : 'llevo',
                      })
                    }
                    onClick={() => navigate(`/items/${item.id}`)}
                  />
                ))}
              </div>
            ) : (
              <List gap="2" columns={2}>
                {list.map((item) => (
                  <ItemRow
                    key={item.id}
                    as="li"
                    name={item.name}
                    quantity={item.quantity}
                    unit={item.unit}
                    status={item.status}
                    urgent={item.priority === 'urgente'}
                    requestedBy={item.requestedBy}
                    assignedTo={item.assignedTo}
                    checked={item.status === 'llevo'}
                    onToggle={() =>
                      toggleMutation.mutate({
                        id: item.id,
                        to: item.status === 'llevo' ? 'falta' : 'llevo',
                      })
                    }
                    onClick={() => navigate(`/items/${item.id}`)}
                  />
                ))}
              </List>
            )}
            {list.some(
              (it) =>
                (it.fallbacks?.length ?? 0) > 0 &&
                it.status !== 'comprado' &&
                it.status !== 'cancelado',
            ) && (
              <Card padding="md">
                <Stack gap="2">
                  <Text variant="section">
                    No había…
                  </Text>
                  {list
                    .filter(
                      (it) =>
                        (it.fallbacks?.length ?? 0) > 0 &&
                        it.status !== 'comprado' &&
                        it.status !== 'cancelado',
                    )
                    .map((it) => (
                      <NoAvailableFlow
                        key={it.id}
                        item={it}
                        onApplied={() => {
                          invalidate()
                          queryClient.invalidateQueries({ queryKey: ['items'] })
                        }}
                      />
                    ))}
                </Stack>
              </Card>
            )}
          </Stack>
        ))
      )}

      {pending.length > 0 && (
        <Button variant="secondary" full onClick={() => navigate('/home')}>
          Ver la lista completa
        </Button>
      )}
    </Stack>
  )
}

interface NoAvailableFlowProps {
  item: GroceryItem
  onApplied: () => void
}

/** "No había X" → ofrece la cadena de alternativas o cancelar el ítem. */
function NoAvailableFlow({ item, onApplied }: NoAvailableFlowProps) {
  const useFallback = useMutation({
    mutationFn: (index: number) => applyItemFallback(item.id, index, ME),
    onSuccess: onApplied,
  })
  const cancel = useMutation({
    mutationFn: () => cancelItem(item.id, ME, 'No había'),
    onSuccess: onApplied,
  })
  const loading = useFallback.isPending || cancel.isPending

  return (
    <div className={styles.noAvail}>
      <Text variant="item" truncate>
        {item.name}
      </Text>
      <div className={styles.noAvailRow}>
        {(item.fallbacks ?? []).map((fb, i) => (
          <Button
            key={`${fb.name}-${i}`}
            size="sm"
            variant="secondary"
            disabled={loading}
            onClick={() => useFallback.mutate(i)}
            aria-label={`Traer ${fb.name} en su lugar`}
          >
            Traer {fb.name} {fb.quantity} {fb.unit}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => cancel.mutate()}
          aria-label={`No traer nada de ${item.name}`}
        >
          <Ban size={14} strokeWidth={2} /> No traer nada
        </Button>
      </div>
    </div>
  )
}
