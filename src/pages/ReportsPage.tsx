import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createItem,
  getItemsPurchasedBetween,
  getProjection,
  getSpending,
  getTopProducts,
  getTripsByMember,
} from '../lib/api'
import { ME } from '../lib/me'
import type { GroceryItem } from '../domain/item'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { Button, Card, Select, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { ArrowLeft, RotateCcw } from 'lucide-react'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import { addDays, localDayRangeISO, todayISO } from '../lib/dates.ts'
import styles from './ReportsPage.module.css'

export default function ReportsPage() {
  const queryClient = useQueryClient()
  const [repeatDate, setRepeatDate] = useState<string>(() => addDays(todayISO(), -1))
  useDocumentTitle('Reportes · Grocery Planner')

  const top = useQuery({ queryKey: ['reports', 'top'], queryFn: getTopProducts, refetchInterval: 20_000 })
  const spending = useQuery({ queryKey: ['reports', 'spending'], queryFn: getSpending, refetchInterval: 20_000 })
  const trips = useQuery({ queryKey: ['reports', 'trips'], queryFn: getTripsByMember, refetchInterval: 20_000 })
  // Misma clave que HomePage: decidir la proyección en un lado refresca el otro.
  const projection = useQuery({ queryKey: ['projection'], queryFn: getProjection, refetchInterval: 20_000 })

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(todayISO(), -i))
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
        items.map((it) =>
          createItem({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            priority: 'media',
            requestedBy: ME,
            category: it.category,
            note: it.note,
          }),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] })
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
        <Text as="h2" variant="section">
          Lo que más compramos
        </Text>
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
                  {repeatItems.length === 1 ? 'ítem' : 'ítems'}:
                </Text>
                {repeatItems.map((it) => (
                  <div key={it.id} className={styles.line}>
                    <Text variant="item">
                      {it.name} · {it.quantity} {it.unit}
                    </Text>
                    {it.category && <Chip tone="muted">{it.category}</Chip>}
                  </div>
                ))}
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
