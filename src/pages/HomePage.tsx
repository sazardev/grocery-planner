import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  changeItemStatus,
  getProjection,
  presenceHeartbeat,
  queryItems,
} from '../lib/api'
import { ME } from '../lib/me'
import type { GroceryItem, ItemStatus } from '../domain/item'
import PresenceStrip from '../components/PresenceStrip.tsx'
import FilterMenu from '../components/FilterMenu.tsx'
import type { FilterOption } from '../components/FilterMenu.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import ItemRow from '../shared/ui/data-display/ItemRow.tsx'
import List from '../shared/ui/data-display/List.tsx'
import TabBar from '../shared/ui/navigation/TabBar.tsx'
import FAB from '../shared/ui/navigation/FAB.tsx'
import Alert from '../shared/ui/feedback/Alert.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { Button, Card, Input, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { BarChart3, Clock3 } from 'lucide-react'
import styles from './HomePage.module.css'

const filterTabs: { key: string; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'falta', label: 'Falta' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'llevo', label: 'Llevo' },
  { key: 'comprado', label: 'Comprado' },
]

const ITEMS_KEY = ['items']

const filterOptions: FilterOption[] = [
  { key: 'todas', label: 'Todas', kind: 'radio' },
  { key: 'falta', label: 'Falta', kind: 'radio' },
  { key: 'pedido', label: 'Pedido', kind: 'radio' },
  { key: 'llevo', label: 'Llevo', kind: 'radio' },
  { key: 'comprado', label: 'Comprado', kind: 'radio' },
  { key: 'urgent', label: 'Solo urgente', kind: 'toggle' },
  { key: 'comments', label: 'Con comentarios', kind: 'toggle' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | null>(null)
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [commentsOnly, setCommentsOnly] = useState(false)
  const activeFilters: string[] = [
    ...(statusFilter ? [statusFilter] : []),
    ...(urgentOnly ? ['urgent'] : []),
    ...(commentsOnly ? ['comments'] : []),
  ]
  useDocumentTitle('¿Qué falta? · Grocery Planner')

  const {
    data: items = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['items', search, statusFilter, urgentOnly, commentsOnly],
    queryFn: () =>
      queryItems({
        search: search.trim() || undefined,
        status: statusFilter ?? undefined,
        urgent: urgentOnly || undefined,
        onlyComments: commentsOnly || undefined,
      }),
  })

  const presence = useQuery({
    queryKey: ['presence'],
    queryFn: () => presenceHeartbeat(ME),
    refetchInterval: 15_000,
  })
  const online = (presence.data ?? []).filter((p) => p.online)

  const projection = useQuery({ queryKey: ['projection'], queryFn: getProjection })
  const proySoon = (projection.data ?? [])
    .filter((p) => p.estFaltaInDays != null && p.estFaltaInDays <= 3)
    .sort((a, b) => (a.estFaltaInDays ?? 0) - (b.estFaltaInDays ?? 0))
    .slice(0, 4)

  const pendingCount = items.filter(
    (i) => i.status === 'falta' || i.status === 'pedido' || i.status === 'llevo',
  ).length

  const toggleMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: ItemStatus }) =>
      changeItemStatus(id, to, ME),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ITEMS_KEY }),
  })

  const toggle = (item: GroceryItem) => {
    const to = item.status === 'llevo' ? 'falta' : 'llevo'
    toggleMutation.mutate({ id: item.id, to })
  }

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div className={styles.headerTitle}>
            <Text as="h1" variant="display">
              ¿Qué falta?
            </Text>
            <Text as="p" variant="note" tone="secondary">
              Faltan {pendingCount} {pendingCount === 1 ? 'cosa' : 'cosas'} por comprar
            </Text>
          </div>
          {online.length > 0 && <PresenceStrip users={online} />}
        </div>
        {isError && (
          <Alert
            tone="danger"
            title="No se pudo cargar la lista."
            onClose={undefined}
          >
            {error instanceof Error ? error.message : 'Revisa que el servidor de la casa esté encendido.'}
          </Alert>
        )}
      </header>

      {proySoon.length > 0 && (
        <Card padding="sm">
          <div className={styles.projRow}>
            <Clock3 size={16} strokeWidth={2} aria-hidden="true" />
            <Text variant="note">
              Pronto hará falta:{' '}
              {proySoon
                .map(
                  (p) =>
                    `${p.name} (en ${p.estFaltaInDays! <= 0 ? '0' : p.estFaltaInDays} día${p.estFaltaInDays === 1 ? '' : 's'})`,
                )
                .join(' · ')}
            </Text>
          </div>
        </Card>
      )}

      <TabBar
        items={filterTabs}
        active={statusFilter ?? 'todas'}
        onChange={(key) => setStatusFilter(key === 'todas' ? null : (key as ItemStatus))}
      />

      <div className={styles.filterRow}>
        <div className={styles.searchWrap}>
          <Input
            size="md"
            placeholder="Buscar… (pollo, leche, nota…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Buscar en la lista"
          />
        </div>
        <FilterMenu
          options={filterOptions}
          active={activeFilters}
          onSelect={(key, kind) => {
            if (kind === 'radio') {
              setStatusFilter(key === 'todas' ? null : (key as ItemStatus))
            } else if (key === 'urgent') {
              setUrgentOnly((v) => !v)
            } else if (key === 'comments') {
              setCommentsOnly((v) => !v)
            }
          }}
        />
      </div>

      {isLoading ? (
        <List gap="3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton variant="rect" height={72} />
            </li>
          ))}
        </List>
      ) : (
        <List gap="3">
          {items.map((item) => (
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
              note={item.note}
              checked={item.status === 'llevo'}
              onToggle={() => toggle(item)}
              onClick={() => navigate(`/items/${item.id}`)}
            />
          ))}
        </List>
      )}

      <div className={styles.chipRow}>
        <Chip tone="warning">{pendingCount} pendientes</Chip>
      </div>

      <Button variant="secondary" full onClick={() => navigate('/reports')}>
        <BarChart3 size={18} strokeWidth={2} aria-hidden="true" /> Ver reportes de la familia
      </Button>

      <FAB
        extended
        label="Falta…"
        ariaLabel="Agregar lo que falta"
        onClick={() => navigate('/items/new')}
      />
    </Stack>
  )
}
