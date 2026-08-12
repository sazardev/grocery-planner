import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createItem,
  getItemsPurchasedBetween,
  getProjection,
  getSpending,
  getTopProducts,
  getTripsByMember,
  type ReportWindow,
  REPORT_WINDOW_LABEL,
} from '../lib/api'
import { ME } from '../lib/me'
import type { GroceryItem } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Checkbox from '../shared/ui/primitives/Checkbox.tsx'
import Input from '../shared/ui/form/Input.tsx'
import { Button, Card, Select, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import { addDays, localDayRangeISO, todayISO } from '../lib/dates.ts'
import { invalidateItems, invalidateTimeline } from '../lib/queryKeys.ts'
import styles from './ReportsPage.module.css'

export default function ReportsPage() {
  const queryClient = useQueryClient()
  const [window, setWindow] = useState<ReportWindow>('30d')
  const [repeatDate, setRepeatDate] = useState<string>(() => addDays(todayISO(), -1))
  const [repeatInclude, setRepeatInclude] = useState<Record<string, boolean>>({})
  const [repeatQty, setRepeatQty] = useState<Record<string, string>>({})
  useDocumentTitle('Reportes · Grocery Planner')

  const top = useQuery({ queryKey: ['reports', 'top', window], queryFn: () => getTopProducts(window), refetchInterval: 20_000 })
  const spending = useQuery({ queryKey: ['reports', 'spending', window], queryFn: () => getSpending(window), refetchInterval: 20_000 })
  const trips = useQuery({ queryKey: ['reports', 'trips'], queryFn: getTripsByMember, refetchInterval: 20_000 })
  // Misma clave que HomePage: decidir la proyección en un lado refresca el otro.
  const projection = useQuery({ queryKey: ['projection'], queryFn: getProjection, refetchInterval: 20_000 })

  const days = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => addDays(todayISO(), -i))
  }, [])

  const repeatQuery = useQuery({
    queryKey: ['reports', 'repeat', repeatDate],
    queryFn: () => {
      const range = localDayRangeISO(repeatDate)
      return getItemsPurchasedBetween(range.start, range.end)
    },
    enabled: Boolean(repeatDate),
  })

  const repeatMutation = useMutation({
    mutationFn: (items: GroceryItem[]) =>
      Promise.all(
        items
          .filter((it) => repeatInclude[it.id] !== false)
          .map((it) =>
            createItem({
              name: it.name,
              quantity: Number(repeatQty[it.id]) || it.quantity,
              unit: it.unit,
              priority: it.priority,
              requestedBy: ME,
              category: it.category,
              note: it.note,
              store: it.store,
              section: it.section,
              brand: it.brand,
            }),
          ),
      ),
    onSuccess: () => {
      invalidateItems(queryClient)
      invalidateTimeline(queryClient)
    },
  })

  const goBack = useGoBack('/home')

  const proy = (projection.data ?? [])
    .filter((p) => p.cadenceDays != null)
    .sort((a, b) => (a.estFaltaInDays ?? 0) - (b.estFaltaInDays ?? 0))
    .slice(0, 8)

  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

  const repeatItems = repeatQuery.data ?? []
  const repeatDone = repeatMutation.isSuccess

  return (
    <Stack gap="6">
      <header className={styles.header}>
        <IconButton label="Volver" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </IconButton>
        <Text as="h1" variant="h1">
          Reportes
        </Text>
      </header>

      <section>
        <Text as="h2" variant="section">
          Próximas faltas
        </Text>
        {projection.isLoading ? (
          <Skeleton variant="rect" height={120} />
        ) : proy.length === 0 ? (
          <Card padding="md">
            <Text as="p" variant="note" tone="secondary">
              Aún no hay historial suficiente. Compra un par de veces el mismo producto y aquí verás cuándo se acaba.
            </Text>
          </Card>
        ) : (
          proy.map((p) => (
            <Card key={p.name} padding="sm">
              <div className={styles.line}>
                <Text variant="item">{p.name}</Text>
                <Text variant="note" tone="secondary">
                  cada {p.cadenceDays} día{p.cadenceDays === 1 ? '' : 's'}
                  {p.estFaltaInDays != null
                    ? ` · faltará en ${p.estFaltaInDays <= 0 ? '0' : p.estFaltaInDays} día${p.estFaltaInDays === 1 ? '' : 's'}`
                    : ''}
                </Text>
              </div>
            </Card>
          ))
        )}
      </section>

      <section>
        <div className={styles.line}>
          <Text as="h2" variant="section">
            Lo que más compramos
          </Text>
          <Select
            size="md"
            value={window}
            onChange={(e) => setWindow(e.target.value as ReportWindow)}
            aria-label="Ventana de los reportes"
          >
            <option value="">Todo el historial</option>
            {(Object.keys(REPORT_WINDOW_LABEL) as Exclude<ReportWindow, ''>[]).map((w) => (
              <option key={w} value={w}>
                {REPORT_WINDOW_LABEL[w]}
              </option>
            ))}
          </Select>
        </div>
        {top.isLoading ? (
          <Skeleton variant="rect" height={120} />
        ) : (top.data ?? []).length === 0 ? (
          <Card padding="md">
            <Text as="p" variant="note" tone="secondary">
              Todavía no hay nada comprado.
            </Text>
          </Card>
        ) : (
          (top.data ?? []).map((p, i) => (
            <Card key={p.name} padding="sm">
              <div className={styles.line}>
                <Text variant="item">
                  {i + 1}. {p.name}
                </Text>
                <Chip>{p.timesBought} {p.timesBought === 1 ? 'vez' : 'veces'}</Chip>
              </div>
            </Card>
          ))
        )}
      </section>

      <section>
        <Text as="h2" variant="section">
          Gasto aproximado
        </Text>
        {spending.isLoading ? (
          <Skeleton variant="rect" height={80} />
        ) : (
          <Card padding="md">
            <div className={styles.line}>
              <Text variant="item">Compras con precio registrado</Text>
              <Text variant="item" numeric>
                {money.format(spending.data?.total ?? 0)}
              </Text>
            </div>
            <Text as="p" variant="note" tone="secondary">
              {spending.data?.itemsCount ?? 0} ítem{(spending.data?.itemsCount ?? 0) === 1 ? '' : 's'} comprados.
            </Text>
          </Card>
        )}
      </section>

      <section>
        <Text as="h2" variant="section">
          <RotateCcw size={16} aria-hidden="true" /> Repetir compra
        </Text>
        <Text as="p" variant="note" tone="secondary">
          "Comprar lo mismo de la semana pasada": elige el día y recrea su lista.
        </Text>
        <Stack gap="2">
          <Select
            label="Día con compras"
            value={repeatDate}
            onChange={(e) => setRepeatDate(e.target.value)}
          >
            {days.map((d) => (
              <option key={d} value={d}>
                {new Date(d + 'T00:00').toLocaleDateString('es-MX', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'short',
                })}
              </option>
            ))}
          </Select>
          {repeatQuery.isLoading ? (
            <Skeleton variant="rect" height={60} />
          ) : repeatItems.length === 0 ? (
            <Card padding="md">
              <Text as="p" variant="note" tone="secondary">
                No se compró nada ese día (o aún no tiene historial).
              </Text>
            </Card>
          ) : (
            <Card padding="md">
              <Stack gap="2">
                <Text variant="note" tone="secondary">
                  Ese día se compraron {repeatItems.length}{' '}
                  {repeatItems.length === 1 ? 'ítem' : 'ítems'}. Marca los que quieras y
                  ajusta la cantidad antes de recrear la lista.
                </Text>
                {repeatItems.map((it) => {
                  const included = repeatInclude[it.id] !== false
                  return (
                    <div key={it.id} className={styles.repeatRow}>
                      <Checkbox
                        checked={included}
                        onChange={() =>
                          setRepeatInclude((s) => ({ ...s, [it.id]: !included }))
                        }
                        size="sm"
                        ariaLabel={`Recrear ${it.name}`}
                      />
                      <div className={styles.repeatInfo}>
                        <Text variant="item">{it.name}</Text>
                        {it.category && <Chip tone="muted">{it.category}</Chip>}
                      </div>
                      <Input
                        type="number"
                        inputMode="decimal"
                        size="md"
                        value={repeatQty[it.id] ?? String(it.quantity)}
                        onChange={(e) =>
                          setRepeatQty((s) => ({ ...s, [it.id]: e.target.value }))
                        }
                        aria-label={`Cantidad de ${it.name}`}
                      />
                      <Text variant="note" tone="secondary">
                        {it.unit}
                      </Text>
                    </div>
                  )
                })}
                <Button
                  onClick={() => repeatMutation.mutate(repeatItems)}
                  loading={repeatMutation.isPending}
                  disabled={repeatMutation.isSuccess}
                >
                  {repeatDone ? '¡Agregado a la lista!' : 'Comprar lo mismo otra vez'}
                </Button>
              </Stack>
            </Card>
          )}
        </Stack>
      </section>

      <section>
        <Text as="h2" variant="section">
          Mandados por persona
        </Text>
        {trips.isLoading ? (
          <Skeleton variant="rect" height={100} />
        ) : (trips.data ?? []).length === 0 ? (
          <Card padding="md">
            <Text as="p" variant="note" tone="secondary">
              Aún no hay mandados completados.
            </Text>
          </Card>
        ) : (
          (trips.data ?? []).map((t) => (
            <Card key={t.member} padding="sm">
              <div className={styles.line}>
                <Text variant="item">{t.member}</Text>
                <Chip>{t.trips} {t.trips === 1 ? 'mandado' : 'mandados'}</Chip>
              </div>
            </Card>
          ))
        )}
      </section>
    </Stack>
  )
}
