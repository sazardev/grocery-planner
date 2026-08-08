import { useQuery } from '@tanstack/react-query'
import { getProjection, getSpending, getTopProducts, getTripsByMember } from '../lib/api'
import Text from '../shared/ui/primitives/Text.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { ArrowLeft } from 'lucide-react'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import { useNavigate } from 'react-router-dom'
import styles from './ReportsPage.module.css'

export default function ReportsPage() {
  const navigate = useNavigate()
  useDocumentTitle('Reportes · Grocery Planner')

  const top = useQuery({ queryKey: ['reports', 'top'], queryFn: getTopProducts })
  const spending = useQuery({ queryKey: ['reports', 'spending'], queryFn: getSpending })
  const trips = useQuery({ queryKey: ['reports', 'trips'], queryFn: getTripsByMember })
  const projection = useQuery({ queryKey: ['reports', 'projection'], queryFn: getProjection })

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const proy = (projection.data ?? [])
    .filter((p) => p.cadenceDays != null)
    .sort((a, b) => (a.estFaltaInDays ?? 0) - (b.estFaltaInDays ?? 0))
    .slice(0, 8)

  const money = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 })

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
