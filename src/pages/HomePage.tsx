import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  changeItemStatus,
  decideProjection,
  getHome,
  getProjection,
  getRules,
  listEvents,
  listSections,
  presenceHeartbeat,
  queryItems,
} from '../lib/api'
import { ME } from '../lib/me'
import type { GroceryItem, ItemStatus, Priority } from '../domain/item'
import type { ItemSort } from '../lib/api/items.ts'
import { ITEM_SORT_LABEL } from '../lib/api/items.ts'
import { addDays, localWindowRangeISO, startOfMonth, startOfWeek, todayISO } from '../lib/dates.ts'
import { invalidateItems, invalidateReports, invalidateTimeline } from '../lib/queryKeys.ts'
import PresenceStrip from '../components/PresenceStrip.tsx'
import FilterMenu from '../components/FilterMenu.tsx'
import ViewToggle from '../components/ViewToggle.tsx'
import KanbanBoard from '../components/KanbanBoard.tsx'
import { loadViewMode, saveViewMode } from '../lib/viewMode.ts'
import type { ListViewMode } from '../lib/viewMode.ts'
import type { FilterOption } from '../components/FilterMenu.tsx'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import ItemRow from '../shared/ui/data-display/ItemRow.tsx'
import ItemCard from '../shared/ui/data-display/ItemCard.tsx'
import List from '../shared/ui/data-display/List.tsx'
import TabBar from '../shared/ui/navigation/TabBar.tsx'
import { useFab } from '../shared/ui/navigation/fab.ts'
import Alert from '../shared/ui/feedback/Alert.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { Button, Card, Input, Select, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { usePresenceLeave } from '../lib/hooks/usePresenceLeave.ts'
import { BarChart3, Bell, CalendarDays, Clock3, History } from 'lucide-react'
import styles from './HomePage.module.css'

const filterTabs: { key: string; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'falta', label: 'Falta' },
  { key: 'pedido', label: 'Pedido' },
  { key: 'llevo', label: 'Llevo' },
  { key: 'comprado', label: 'Comprado' },
]

const SECTION_ORDER: ItemStatus[] = ['falta', 'pedido', 'llevo', 'comprado', 'cancelado']
const SECTION_TITLE: Record<ItemStatus, string> = {
  falta: 'Falta',
  pedido: 'Pedido',
  llevo: 'Ya lo llevo',
  comprado: 'Comprado',
  cancelado: 'Cancelado',
}

const isTerminal = (s: ItemStatus) => s === 'comprado' || s === 'cancelado'

const filterOptions: FilterOption[] = [
  { key: 'todas', label: 'Todas', kind: 'radio' },
  { key: 'falta', label: 'Falta', kind: 'radio' },
  { key: 'pedido', label: 'Pedido', kind: 'radio' },
  { key: 'llevo', label: 'Llevo', kind: 'radio' },
  { key: 'comprado', label: 'Comprado', kind: 'radio' },
  { key: 'urgent', label: 'Solo urgente', kind: 'toggle' },
  { key: 'comments', label: 'Con comentarios', kind: 'toggle' },
  { key: 'photos', label: 'Con foto', kind: 'toggle' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ItemStatus | null>(null)
  const [urgentOnly, setUrgentOnly] = useState(false)
  const [commentsOnly, setCommentsOnly] = useState(false)
  const [photosOnly, setPhotosOnly] = useState(false)
  const [category, setCategory] = useState('')
  const [priority, setPriority] = useState('')
  const [sectionFilter, setSectionFilter] = useState('')
  const [member, setMember] = useState('')
  const [assigned, setAssigned] = useState('')
  const [store, setStore] = useState('')
  const [aisle, setAisle] = useState('')
  const [dateWindow, setDateWindow] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const [eventId, setEventId] = useState('')
  const [sort, setSort] = useState<ItemSort>('priority')
  const [view, setView] = useState<ListViewMode>(loadViewMode)
  useEffect(() => saveViewMode(view), [view])

  const rulesQuery = useQuery({ queryKey: ['rules'], queryFn: getRules, staleTime: 30_000 })
  const sectionsQuery = useQuery({ queryKey: ['sections'], queryFn: listSections, staleTime: 30_000 })
  const eventsQuery = useQuery({ queryKey: ['events'], queryFn: listEvents, staleTime: 30_000 })

  // Ventana de fecha local → rango ISO UTC (SPEC §4.5).
  const dateRange = (() => {
    if (!dateWindow) return { from: undefined, to: undefined }
    const today = todayISO()
    const start =
      dateWindow === 'hoy'
        ? today
        : dateWindow === 'semana'
          ? startOfWeek(today)
          : dateWindow === 'mes'
            ? startOfMonth(today)
            : dateWindow === 'anio'
              ? `${today.slice(0, 4)}-01-01`
              : dateWindow === '7d'
                ? addDays(today, -6)
                : addDays(today, -29)
    const end =
      dateWindow === 'anio' ? `${today.slice(0, 4)}-12-31` : today
    const r = localWindowRangeISO(start, end)
    return { from: r.start, to: r.end }
  })()

  const activeFilters: string[] = [
    ...(statusFilter ? [statusFilter] : []),
    ...(urgentOnly ? ['urgent'] : []),
    ...(commentsOnly ? ['comments'] : []),
    ...(photosOnly ? ['photos'] : []),
    ...(category ? ['cat'] : []),
    ...(priority ? ['pri'] : []),
    ...(sectionFilter ? ['sec'] : []),
    ...(member ? ['who'] : []),
    ...(assigned ? ['assigned'] : []),
    ...(store ? ['store'] : []),
    ...(aisle ? ['aisle'] : []),
    ...(dateWindow ? ['when'] : []),
    ...(onlyMine ? ['mine'] : []),
    ...(eventId ? ['event'] : []),
  ]
  useDocumentTitle('¿Qué falta? · Grocery Planner')
  usePresenceLeave(ME)

  useFab({
    label: 'Falta…',
    ariaLabel: 'Agregar lo que falta',
    onClick: () => navigate('/items/new'),
  })

  const {
    data: items = [],
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['items', search, statusFilter, urgentOnly, commentsOnly, photosOnly, category, priority, sectionFilter, member, assigned, store, aisle, dateWindow, onlyMine, eventId, sort],
    queryFn: () =>
      queryItems({
        search: search.trim() || undefined,
        status: statusFilter ?? undefined,
        urgent: urgentOnly || undefined,
        onlyComments: commentsOnly || undefined,
        onlyPhotos: photosOnly || undefined,
        category: category || undefined,
        priority: (priority || undefined) as Priority | undefined,
        section: sectionFilter || undefined,
        requestedBy: member || undefined,
        assignedTo: assigned || undefined,
        store: store || undefined,
        aisle: aisle || undefined,
        createdFrom: dateRange.from,
        createdTo: dateRange.to,
        sort,
      }).then((rows) =>
        // "Lo que me toca a mí" y "de este evento" se filtran en el cliente
        // (asignación propia y lista del evento, SPEC §4.5).
        rows.filter((i) => {
          if (onlyMine && i.assignedTo !== ME) return false
          if (eventId) {
            const ev = eventsQuery.data?.find((e) => e.id === eventId)
            if (!ev || !ev.itemIds.includes(i.id)) return false
          }
          return true
        }),
      ),
    refetchInterval: 20_000,
  })

  const presence = useQuery({
    queryKey: ['presence'],
    queryFn: () => presenceHeartbeat(ME),
    refetchInterval: 15_000,
  })
  const presenceUsers = presence.data ?? []
  const online = presenceUsers.filter((p) => p.online)

  const projection = useQuery({ queryKey: ['projection'], queryFn: getProjection })

  // Sin hogar aún: invita a crear la familia o a unirse con un código.
  const homeQuery = useQuery({
    queryKey: ['home'],
    queryFn: getHome,
    retry: false,
    refetchInterval: 30_000,
  })
  const noHome =
    homeQuery.isError && homeQuery.error instanceof Error && homeQuery.error.message.includes('no se crea el hogar')
  const proySoon = (projection.data ?? [])
    .filter((p) => p.estFaltaInDays != null && p.estFaltaInDays <= 3)
    .sort((a, b) => (a.estFaltaInDays ?? 0) - (b.estFaltaInDays ?? 0))
    .slice(0, 4)

  const decideMutation = useMutation({
    mutationFn: ({ name, confirmed }: { name: string; confirmed: boolean }) =>
      decideProjection(name, confirmed),
    onSuccess: () => {
      // "Sí, falta" crea el ítem: refresca la lista, los reportes y la
      // proyección para que todo se vea al momento.
      invalidateItems(queryClient)
      invalidateReports(queryClient)
    },
  })

  const pendingCount = items.filter(
    (i) => i.status === 'falta' || i.status === 'pedido' || i.status === 'llevo',
  ).length

  const statusMutation = useMutation({
    mutationFn: ({ id, to }: { id: string; to: ItemStatus }) =>
      changeItemStatus(id, to, ME),
    // Optimistic: la fila cambia al instante; el polling/re-fetch reconcilia.
    onMutate: async ({ id, to }) => {
      await queryClient.cancelQueries({ queryKey: ['items'] })
      const prev = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['items'] })
        .map((q) => [q.queryKey, q.state.data] as const)
      queryClient.setQueriesData(
        { queryKey: ['items'] },
        (old: GroceryItem[] | undefined) =>
          old?.map((i) => (i.id === id ? { ...i, status: to } : i)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      for (const [k, d] of ctx?.prev ?? []) queryClient.setQueryData(k, d)
    },
    onSettled: () => {
      // "Lo mío", el quiosco y el historial ven el cambio sin esperar su poll.
      invalidateItems(queryClient)
      invalidateTimeline(queryClient)
    },
  })

  const toggle = (item: GroceryItem) => {
    const to = item.status === 'llevo' ? 'falta' : 'llevo'
    statusMutation.mutate({ id: item.id, to })
  }

  const grouped = SECTION_ORDER.map((s) => ({
    key: s,
    title: SECTION_TITLE[s],
    items: items.filter((i) => i.status === s),
  })).filter((g) => g.items.length > 0)
  const showSections = sort !== 'manual'

  const rowProps = (item: GroceryItem) => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    status: item.status,
    urgent: item.priority === 'urgente',
    requestedBy: item.requestedBy,
    assignedTo: item.assignedTo,
    store: item.store,
    aisle: item.aisle,
    commentCount: item.comments.length,
    photoCount: item.photos.length,
    note: item.note,
    actionLabel: SECTION_TITLE[item.status],
    checked: item.status === 'llevo' || item.status === 'comprado',
    disabled: isTerminal(item.status),
    onToggle: isTerminal(item.status) ? undefined : () => toggle(item),
    onQuit: item.status === 'llevo' ? () => toggle(item) : undefined,
    onClick: () => navigate(`/items/${item.id}`),
  })

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
          {online.length > 0 && <PresenceStrip users={presenceUsers} />}
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

      {noHome && (
        <Card padding="md">
          <Stack gap="2">
            <Text variant="item">Aún no estás en un hogar</Text>
            <Text as="p" variant="note" tone="secondary">
              Crea la familia para compartir la lista, o únete con la invitación
              que te pasaron.
            </Text>
            <div className={styles.projActions}>
              <Button size="sm" onClick={() => navigate('/family')}>
                Crear la familia
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate('/family/join')}>
                Unirme con un código
              </Button>
            </div>
          </Stack>
        </Card>
      )}

      {proySoon.length > 0 && (
        <Card padding="sm">
          <Stack gap="2">
            <div className={styles.projRow}>
              <Clock3 size={16} strokeWidth={2} aria-hidden="true" />
              <Text variant="note" weight="medium">
                Pronto hará falta:
              </Text>
            </div>
            {proySoon.map((p) => {
              const days = p.estFaltaInDays! <= 0 ? 'hoy' : `en ${p.estFaltaInDays} día${p.estFaltaInDays === 1 ? '' : 's'}`
              return (
                <div key={p.name} className={styles.projItem}>
                  <Text variant="note">
                    {p.name} ({days})
                  </Text>
                  {!p.decided ? (
                    <div className={styles.projActions}>
                      <Chip tone="default" onClick={() => decideMutation.mutate({ name: p.name, confirmed: true })}>
                        Sí, falta
                      </Chip>
                      <Chip tone="muted" onClick={() => decideMutation.mutate({ name: p.name, confirmed: false })}>
                        No hace falta
                      </Chip>
                    </div>
                  ) : (
                    <Chip tone={p.confirmed ? 'default' : 'muted'}>
                      {p.confirmed ? 'sí falta' : 'descartado'}
                    </Chip>
                  )}
                </div>
              )
            })}
          </Stack>
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
        <ViewToggle view={view} onChange={setView} />
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
            } else if (key === 'photos') {
              setPhotosOnly((v) => !v)
            }
          }}
        />
      </div>

      <div className={styles.advRow}>
        <Select
          size="md"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filtrar por categoría"
        >
          <option value="">Categoría</option>
          {rulesQuery.data?.categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select
          size="md"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          aria-label="Filtrar por prioridad"
        >
          <option value="">Prioridad</option>
          <option value="urgente">Urgente</option>
          <option value="alta">Alta</option>
          <option value="media">Media</option>
          <option value="baja">Baja</option>
        </Select>
        <Select
          size="md"
          value={sectionFilter}
          onChange={(e) => setSectionFilter(e.target.value)}
          aria-label="Filtrar por sección"
        >
          <option value="">Sección</option>
          {sectionsQuery.data?.map((s) => (
            <option key={s.id} value={s.name}>
              {s.name}
            </option>
          ))}
        </Select>
        <Select
          size="md"
          value={member}
          onChange={(e) => setMember(e.target.value)}
          aria-label="Filtrar por quien lo pidió"
        >
          <option value="">Quién lo pidió</option>
          {homeQuery.data?.members.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </Select>
        <Select
          size="md"
          value={assigned}
          onChange={(e) => setAssigned(e.target.value)}
          aria-label="Filtrar por asignado a"
        >
          <option value="">Asignado a</option>
          {homeQuery.data?.members.map((m) => (
            <option key={m.name} value={m.name}>
              {m.name}
            </option>
          ))}
        </Select>
        <Select
          size="md"
          value={store}
          onChange={(e) => {
            setStore(e.target.value)
            setAisle('')
          }}
          aria-label="Filtrar por tienda"
        >
          <option value="">Tienda</option>
          {rulesQuery.data?.stores.map((s) => (
            <option key={s.name} value={s.name}>
              {s.name}
            </option>
          ))}
        </Select>
        {store && (
          <Select
            size="md"
            value={aisle}
            onChange={(e) => setAisle(e.target.value)}
            aria-label="Filtrar por pasillo"
          >
            <option value="">Pasillo</option>
            {rulesQuery.data?.stores.find((s) => s.name === store)?.aisles.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        )}
        <Select
          size="md"
          value={dateWindow}
          onChange={(e) => setDateWindow(e.target.value)}
          aria-label="Filtrar por ventana de tiempo"
        >
          <option value="">Fecha</option>
          <option value="hoy">Hoy</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mes</option>
          <option value="anio">Este año</option>
        </Select>
        <Select
          size="md"
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          aria-label="Filtrar por evento"
        >
          <option value="">De un evento</option>
          {eventsQuery.data?.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </Select>
        <Chip
          tone={onlyMine ? 'default' : 'muted'}
          onClick={() => setOnlyMine((v) => !v)}
        >
          Lo que me toca
        </Chip>
      </div>

      <Select
        size="md"
        value={sort}
        onChange={(e) => setSort(e.target.value as ItemSort)}
        aria-label="Ordenar la lista"
      >
        {(Object.keys(ITEM_SORT_LABEL) as ItemSort[]).map((k) => (
          <option key={k} value={k}>
            {ITEM_SORT_LABEL[k]}
          </option>
        ))}
      </Select>

      {!isLoading && items.length > 0 && (
        <Text variant="note" tone="tertiary">
          {view === 'kanban'
            ? 'Arrastra una tarjeta a otra columna para cambiar su estado.'
            : 'Toca la bolita para decir «ya lo llevo».'}
        </Text>
      )}

      {isLoading ? (
        <List gap="3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i}>
              <Skeleton variant="rect" height={72} />
            </li>
          ))}
        </List>
      ) : view === 'kanban' ? (
        <KanbanBoard
          items={items}
          onMove={(id, to) => statusMutation.mutate({ id, to })}
          onOpen={(id) => navigate(`/items/${id}`)}
        />
      ) : view === 'grid' ? (
        <Stack gap="4">
          {showSections
            ? grouped.map((section) => (
                <Stack key={section.key} gap="2">
                  <SectionHeader title={section.title} count={section.items.length} />
                  <div className={styles.itemGrid}>
                    {section.items.map((item) => (
                      <ItemCard {...rowProps(item)} key={item.id} />
                    ))}
                  </div>
                </Stack>
              ))
            : (
              <div className={styles.itemGrid}>
                {items.map((item) => (
                  <ItemCard {...rowProps(item)} key={item.id} />
                ))}
              </div>
            )}
        </Stack>
      ) : (
        <Stack gap="3">
          {showSections
            ? grouped.map((section) => (
                <Stack key={section.key} gap="2">
                  <SectionHeader title={section.title} count={section.items.length} />
                  <List gap="3" columns={2}>
                    {section.items.map((item) => (
                      <ItemRow {...rowProps(item)} key={item.id} as="li" />
                    ))}
                  </List>
                </Stack>
              ))
            : (
              <List gap="3" columns={2}>
                {items.map((item) => (
                  <ItemRow {...rowProps(item)} key={item.id} as="li" />
                ))}
              </List>
            )}
        </Stack>
      )}

      <div className={styles.chipRow}>
        <Chip tone="warning">{pendingCount} pendientes</Chip>
      </div>

      <div className={styles.quickRow}>
        <Button variant="secondary" size="sm" onClick={() => navigate('/calendar')}>
          <CalendarDays size={16} strokeWidth={2} aria-hidden="true" /> Calendario
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/history')}>
          <History size={16} strokeWidth={2} aria-hidden="true" /> Historial
        </Button>
        <Button variant="secondary" size="sm" onClick={() => navigate('/notifications')}>
          <Bell size={16} strokeWidth={2} aria-hidden="true" /> Avisos
        </Button>
      </div>

      <Button variant="secondary" full onClick={() => navigate('/reports')}>
        <BarChart3 size={18} strokeWidth={2} aria-hidden="true" /> Ver reportes de la familia
      </Button>
    </Stack>
  )
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className={styles.sectionHeader}>
      <Text variant="label" uppercase tone="secondary">
        {title}
      </Text>
      <span className={styles.sectionCount}>{count}</span>
    </div>
  )
}
