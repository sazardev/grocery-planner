import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listPlans } from '../lib/api'
import type { Plan } from '../domain/plan'
import Text from '../shared/ui/primitives/Text.tsx'
import Button from '../shared/ui/primitives/Button.tsx'
import IconButton from '../shared/ui/primitives/IconButton.tsx'
import Chip from '../shared/ui/primitives/Chip.tsx'
import Skeleton from '../shared/ui/primitives/Skeleton.tsx'
import EmptyState from '../shared/ui/feedback/EmptyState.tsx'
import { Card, Stack } from '../shared/ui/index.ts'
import { useDocumentTitle } from '../lib/hooks/useDocumentTitle.ts'
import { useGoBack } from '../lib/hooks/useGoBack.ts'
import { ArrowLeft, CalendarClock, Plus } from 'lucide-react'
import styles from './PlansPage.module.css'

const planStatusLabel: Record<Plan['status'], string> = {
  planificado: 'Planificado',
  activo: 'Activo',
  completado: 'Completado',
  cancelado: 'Cancelado',
}

export default function PlansPage() {
  const navigate = useNavigate()
  useDocumentTitle('Plan de compras · Grocery Planner')

  const plans = useQuery({ queryKey: ['plans'], queryFn: listPlans, refetchInterval: 15_000 })

  const goBack = useGoBack('/calendar')

  return (
    <Stack gap="6">
      <header>
        <div className={styles.headerRow}>
          <IconButton label="Volver al calendario" onClick={goBack}>
            <ArrowLeft size={22} strokeWidth={2} />
          </IconButton>
          <Text as="h1" variant="h1">
            Plan de compras
          </Text>
        </div>
        <Text as="p" variant="note" tone="secondary">
          Elige cuándo ir a comprar, a qué tienda y quién se encarga.
        </Text>
      </header>

      <Button
        iconLeft={<Plus size={18} strokeWidth={2.5} aria-hidden="true" />}
        onClick={() => navigate('/plans/new')}
        full
      >
        Nuevo plan
      </Button>

      {plans.isLoading ? (
        <Skeleton variant="rect" height={120} />
      ) : plans.data && plans.data.length > 0 ? (
        <Stack gap="2">
          <Text as="h2" variant="section">
            Planes
          </Text>
          {plans.data.map((plan: Plan) => (
            <Card
              key={plan.id}
              padding="md"
              interactive
              onClick={() => navigate(`/plans/${plan.id}`)}
            >
              <Stack gap="1">
                <div className={styles.line}>
                  <Text variant="item">{plan.title}</Text>
                  <Chip tone="default">{planStatusLabel[plan.status]}</Chip>
                </div>
                <Text as="p" variant="note" tone="secondary">
                  {plan.scheduledAt}
                  {plan.store ? ` · ${plan.store}` : ''}
                  {plan.assignedTo ? ` · lo lleva ${plan.assignedTo}` : ''}
                </Text>
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <EmptyState
          icon={<CalendarClock size={28} strokeWidth={2} aria-hidden="true" />}
          title="Aún no hay planes"
          description="Crea un plan y elige cuándo van a comprar."
        />
      )}
    </Stack>
  )
}
